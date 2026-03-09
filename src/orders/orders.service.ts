import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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

  async create(body: any, employeeId?: number) {
    const { supplier_id, order_status, items } = body || {};
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('items required');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchase_order.create({
        data: {
          order_status: order_status || 'Pending',
          supplier_id: supplier_id ?? null,
        }
      });

      const itemsCreated: any[] = [];
      for (const it of items) {
        if (!it.ingredient_id || !it.quantity) {
          throw new BadRequestException('ingredient_id and quantity required');
        }
        const createdItem = await tx.purchase_order_item.create({
          data: {
            order_id: order.order_id,
            ingredient_id: it.ingredient_id,
            quantity: it.quantity,
            unit_cost: it.unit_cost ?? null,
          }
        });
        itemsCreated.push(createdItem);
      }

      if (String(order.order_status).toLowerCase() === 'received') {
        for (const it of items) {
          await tx.ingredient.update({
            where: { ingredient_id: it.ingredient_id },
            data: {
              quantity_on_hand: { increment: it.quantity }
            }
          });
          await tx.inventory_transaction.create({
            data: {
              ingredient_id: it.ingredient_id,
              transaction_type: 'IN',
              quantity: it.quantity,
              reference_id: String(order.order_id),
              notes: 'Received from PO',
              employee_id: employeeId || null
            }
          });
        }
      }

      return { ...order, items: itemsCreated };
    });
  }

  async updateStatus(id: number, status: string, itemExpiries?: { order_item_id: number; expire_date: string }[], employeeId?: number) {
    if (!status) throw new BadRequestException('status required');
    
    return this.prisma.$transaction(async (tx) => {
      let order;
      try {
        order = await tx.purchase_order.update({
          where: { order_id: id },
          data: { order_status: status }
        });
      } catch (e: any) {
        if (e.code === 'P2025') throw new NotFoundException('Order not found');
        throw e;
      }

      if (String(status).toLowerCase() === 'received') {
        const items = await tx.purchase_order_item.findMany({
          where: { order_id: id }
        });
        
        for (const it of items) {
          if (it.quantity && it.ingredient_id) {
            // Increment total quantity
            await tx.ingredient.update({
              where: { ingredient_id: it.ingredient_id },
              data: {
                quantity_on_hand: { increment: it.quantity }
              }
            });
            
            // Create a specific batch
            const expData = itemExpiries?.find(x => Number(x.order_item_id) === Number(it.order_item_id));
            console.log('Match expData', expData, 'for item', it.order_item_id);
            await tx.ingredient_batch.create({
              data: {
                ingredient_id: it.ingredient_id,
                quantity_on_hand: it.quantity,
                expire_date: expData?.expire_date ? new Date(expData.expire_date) : null,
                cost_per_unit: it.unit_cost ?? null
              }
            });

            await tx.inventory_transaction.create({
              data: {
                ingredient_id: it.ingredient_id,
                transaction_type: 'IN',
                quantity: it.quantity,
                reference_id: String(id),
                notes: 'Received from PO',
                employee_id: employeeId || null
              }
            });
          }
        }
      }

      return order;
    });
  }
}
