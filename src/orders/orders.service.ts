import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ReceiveOrderDto } from './dto/receive-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listWithItems() {
    const orders = await this.prisma.purchase_order.findMany({
      include: {
        supplier: { select: { supplier_name: true } },
        purchase_order_item: {
          include: {
            ingredient: { select: { ingredient_name: true, unit: true } }
          },
          orderBy: { order_item_id: 'asc' }
        }
      },
      orderBy: { order_id: 'desc' }
    });

    return orders.map(o => ({
      ...o,
      supplier_name: o.supplier?.supplier_name || null,
      items: o.purchase_order_item.map(it => ({
        ...it,
        ingredient_name: it.ingredient?.ingredient_name || null,
        unit: it.ingredient?.unit || null
      }))
    }));
  }

  async create(dto: CreateOrderDto, employeeId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const today = new Date();
      const yearStr = today.getFullYear().toString();
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const prefix = `PO${yearStr}${monthStr}-`;

      const lastOrder = await tx.purchase_order.findFirst({
        where: { po_number: { startsWith: prefix } },
        orderBy: { po_number: 'desc' },
        select: { po_number: true }
      });

      let nextIndex = 1;
      if (lastOrder?.po_number) {
        const lastIndexStr = lastOrder.po_number.replace(prefix, '');
        const parsed = parseInt(lastIndexStr, 10);
        if (!isNaN(parsed)) nextIndex = parsed + 1;
      }
      const newPoNumber = `${prefix}${String(nextIndex).padStart(4, '0')}`;

      const order = await tx.purchase_order.create({
        data: {
          po_number: newPoNumber,
          order_status: 'Pending',
          supplier_id: dto.supplier_id ?? null,
          delivery_date: dto.delivery_date ? new Date(dto.delivery_date) : null,
          credit_days: dto.credit_days ?? null,
          payment_terms: dto.payment_terms ?? null,
          payment_method: dto.payment_method ?? null,
          subtotal: dto.subtotal ?? null,
          tax_rate: dto.tax_rate ?? undefined,
          tax_amount: dto.tax_amount ?? null,
          total_amount: dto.total_amount ?? null,
          notes: dto.notes ?? null,
          document_url: dto.document_url ?? null,
        }
      });

      const itemsCreated: any[] = [];
      for (const it of dto.items) {
        const createdItem = await tx.purchase_order_item.create({
          data: {
            order_id: order.order_id,
            ingredient_id: it.ingredient_id,
            quantity: it.quantity,
            received_quantity: 0,
            unit_cost: it.unit_cost ?? null,
          }
        });
        itemsCreated.push(createdItem);
      }

      return { ...order, items: itemsCreated };
    });
  }

  async updateStatus(id: number, status: string) {
    if (!status) throw new BadRequestException('status required');

    try {
      return await this.prisma.purchase_order.update({
        where: { order_id: id },
        data: { order_status: status }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Order not found');
      throw e;
    }
  }

  async receivePO(orderId: number, dto: ReceiveOrderDto, employeeId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchase_order.findUnique({
        where: { order_id: orderId },
        include: { purchase_order_item: true }
      });

      if (!order) throw new NotFoundException('Order not found');

      for (const rx of dto.itemsToReceive) {
        const item = order.purchase_order_item.find(
          i => Number(i.order_item_id) === Number(rx.order_item_id)
        );
        if (!item || !item.ingredient_id) continue;

        const rQty = Number(rx.received_quantity);
        if (rQty <= 0) continue;

        await tx.purchase_order_item.update({
          where: { order_item_id: item.order_item_id },
          data: { received_quantity: { increment: rQty } }
        });

        await tx.ingredient_batch.create({
          data: {
            ingredient_id: item.ingredient_id,
            quantity_on_hand: rQty,
            expire_date: rx.expire_date ? new Date(rx.expire_date) : null,
            cost_per_unit: item.unit_cost ?? null
          }
        });

        // Sync ingredient.quantity_on_hand from batch totals
        const allBatches = await tx.ingredient_batch.findMany({
          where: { ingredient_id: item.ingredient_id, quantity_on_hand: { gt: 0 } },
        });
        const newTotal = allBatches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
        await tx.ingredient.update({
          where: { ingredient_id: item.ingredient_id },
          data: { quantity_on_hand: newTotal }
        });

        await tx.inventory_transaction.create({
          data: {
            ingredient_id: item.ingredient_id,
            transaction_type: 'RECEIVE_PO',
            quantity: rQty,
            reference_id: order.po_number || String(orderId),
            notes: `Received from PO ${order.po_number || orderId}`,
            employee_id: employeeId || null
          }
        });
      }

      // Check if all items are fully received
      const updatedItems = await tx.purchase_order_item.findMany({
        where: { order_id: orderId }
      });

      const isFullyReceived = updatedItems.every(
        i => (i.received_quantity || 0) >= (i.quantity || 0)
      );
      const hasAnyReceived = updatedItems.some(i => (i.received_quantity || 0) > 0);

      let newStatus = order.order_status;
      if (isFullyReceived) {
        newStatus = 'Received';
      } else if (hasAnyReceived) {
        newStatus = 'Partial';
      }

      const updatedOrder = await tx.purchase_order.update({
        where: { order_id: orderId },
        data: {
          order_status: newStatus,
          received_date: isFullyReceived ? new Date() : undefined,
          goods_receipt_url: dto.goods_receipt_url ?? order.goods_receipt_url,
          tax_invoice_url: dto.tax_invoice_url ?? order.tax_invoice_url,
        }
      });

      return { ...updatedOrder, items: updatedItems };
    });
  }
}
