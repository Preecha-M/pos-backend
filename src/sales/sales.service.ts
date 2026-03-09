import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(user: any, body: any) {
    const employee_id = user.employee_id;
    const {
      member_id,
      promotion_id,
      payment_method,
      discount_amount,
      cash_received,
      items,
    } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items required');
    }

    return this.prisma.$transaction(async (tx) => {
      const menuIds = items
        .map((i: any) => Number(i.menu_id))
        .filter(Number.isFinite);

      const menus = await tx.menu.findMany({
        where: { menu_id: { in: menuIds } },
        select: { menu_id: true, price: true }
      });

      const priceMap = new Map<number, number>(
        menus.map((m) => [m.menu_id, Number(m.price)]),
      );

      let subtotal = 0;

      const preparedItems = items.map((it: any) => {
        const quantity = Number(it.quantity || 0);
        if (quantity <= 0) {
          throw new BadRequestException('quantity must be greater than 0');
        }

        const unit_price = priceMap.get(Number(it.menu_id));
        if (!unit_price || unit_price <= 0) {
          throw new BadRequestException('invalid unit_price');
        }

        let itemTotal = unit_price * quantity;
        const mappedOptions: any[] = [];
        
        if (it.options && Array.isArray(it.options)) {
          for (const opt of it.options) {
            const addPrice = Number(opt.additional_price || 0);
            itemTotal += (addPrice * quantity);
            mappedOptions.push({
              option_name: opt.option_name,
              additional_price: addPrice
            });
          }
        }

        subtotal += itemTotal;

        return {
          menu_id: Number(it.menu_id),
          quantity,
          unit_price,
          options: mappedOptions
        };
      });

      const discount = Number(discount_amount || 0);
      const net_total = subtotal - discount;

      if (net_total < 0) {
        throw new BadRequestException('net_total cannot be negative');
      }

      let change_amount: number | null = null;

      if ((payment_method || 'Cash') === 'Cash') {
        const cash = Number(cash_received);

        if (!Number.isFinite(cash)) {
          throw new BadRequestException(
            'cash_received is required for Cash payment',
          );
        }

        if (cash < net_total) {
          throw new BadRequestException('cash_received is less than net_total');
        }

        change_amount = cash - net_total;
      }

      let currentRoundId: number | null = null;
      try {
        const round = await tx.sales_round.findFirst({
          where: { status: 'open' },
          orderBy: { opened_at: 'desc' },
          select: { round_id: true }
        });
        if (round) {
          currentRoundId = round.round_id;
        }
      } catch (e) {
        console.warn('Could not fetch current sales round:', e);
      }

      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const receipt_number = body.receipt_number || `INV-${dateStr}-${randomId}`;

      const sale = await tx.sale.create({
        data: {
          receipt_number,
          subtotal,
          discount_amount: discount,
          net_total,
          payment_method: payment_method || 'Cash',
          cash_received: payment_method === 'Cash' ? cash_received : null,
          change_amount,
          employee_id,
          member_id: member_id ?? null,
          promotion_id: promotion_id ?? null,
          round_id: currentRoundId,
        }
      });

      for (const it of preparedItems) {
        const createdItem = await tx.sale_item.create({
          data: {
            sale_id: sale.sale_id,
            menu_id: it.menu_id,
            quantity: it.quantity,
            unit_price: it.unit_price
          }
        });
        
        if (it.options.length > 0) {
          const optionsData = it.options.map((opt: any) => ({
            sale_item_id: createdItem.sale_item_id,
            option_name: opt.option_name,
            additional_price: opt.additional_price
          }));
          await tx.sale_item_option.createMany({ data: optionsData });
        }
      }

      if (member_id) {
        const earnedPoints = Math.floor(net_total / 100);
        if (earnedPoints > 0) {
          await tx.member.update({
            where: { member_id },
            data: { points: { increment: earnedPoints } }
          });
          await tx.point_transaction.create({
            data: {
              member_id,
              sale_id: sale.sale_id,
              points_change: earnedPoints,
              transaction_type: 'EARN',
              notes: 'Earned from purchase'
            }
          });
        }
      }

      const saleResult = { ...sale, items: preparedItems };

      // Broadcast new sale to connected clients
      this.eventsGateway.emitNewSale(saleResult);

      return saleResult;
    });
  }

  
  async list(query: any) {
    const { mode, month, date } = query || {};
    const allowedModes = ['month', 'year', 'custom', 'day'];
    
    if (mode && !allowedModes.includes(mode)) {
      throw new BadRequestException(`Invalid mode. Allowed: ${allowedModes.join(', ')}`);
    }

    const where: any = {};
    const now = new Date();

    if (mode === 'month') {
      const gte = new Date(now.getFullYear(), now.getMonth(), 1);
      const lt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      where.sale_datetime = { gte, lt };
    } else if (mode === 'year') {
      const gte = new Date(now.getFullYear(), 0, 1);
      const lt = new Date(now.getFullYear() + 1, 0, 1);
      where.sale_datetime = { gte, lt };
    } else if (mode === 'custom') {
      if (!month) throw new BadRequestException('month is required when mode=custom');
      if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Invalid month format. Expected YYYY-MM');
      
      const [yearStr, monthStr] = month.split('-');
      const y = Number(yearStr);
      const m = Number(monthStr) - 1; // 0-indexed month
      
      const gte = new Date(y, m, 1);
      const lt = new Date(y, m + 1, 1);
      where.sale_datetime = { gte, lt };
    } else if (mode === 'day') {
      if (!date) throw new BadRequestException('date is required when mode=day');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
      
      const [y, m, d] = date.split('-').map(Number);
      const gte = new Date(y, m - 1, d);
      const lt = new Date(y, m - 1, d + 1);
      where.sale_datetime = { gte, lt };
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        employee: { select: { username: true } },
        member: { select: { name: true } },
        promotion: { select: { promotion_name: true } },
        sale_item: {
          include: { menu: { select: { menu_name: true } } },
          orderBy: { sale_item_id: 'asc' }
        }
      },
      orderBy: { sale_datetime: 'desc' }
    });

    return sales.map(s => ({
      ...s,
      employee_username: s.employee?.username || null,
      member_name: s.member?.name || null,
      promotion_name: s.promotion?.promotion_name || null,
      items: s.sale_item.map(it => ({
        ...it,
        menu_name: it.menu?.menu_name || null
      }))
    }));
  }


  async getById(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { sale_id: id },
      include: {
        employee: { select: { username: true } },
        member: { select: { name: true } },
        promotion: { select: { promotion_name: true } },
        sale_item: {
          include: { menu: { select: { menu_name: true } } },
          orderBy: { sale_item_id: 'asc' }
        }
      }
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return {
      ...sale,
      employee_username: sale.employee?.username || null,
      member_name: sale.member?.name || null,
      promotion_name: sale.promotion?.promotion_name || null,
      items: sale.sale_item.map(it => ({
        ...it,
        menu_name: it.menu?.menu_name || null
      }))
    };
  }


  async remove(id: number) {
    try {
      await this.prisma.sale.update({
        where: { sale_id: id },
        data: { status: 'VOIDED' }
      });
      return { message: 'Voided (Soft Deleted)' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Sale not found');
      throw e;
    }
  }
}
