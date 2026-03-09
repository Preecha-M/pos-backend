import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SalesRoundService {
  constructor(private readonly prisma: PrismaService) {}


  async openRound(user: any, body: any) {
    const { opening_cash } = body;
    const employee_id = user.employee_id;

    if (opening_cash === undefined || opening_cash === null || Number(opening_cash) < 0) {
      throw new BadRequestException('opening_cash must be >= 0');
    }

    const existingRound = await this.prisma.sales_round.findFirst({
      where: { status: 'open' },
      orderBy: { opened_at: 'desc' }
    });

    if (existingRound) {
      throw new BadRequestException(
        'มีรอบการขายที่เปิดอยู่แล้ว กรุณาปิดรอบก่อนเปิดรอบใหม่',
      );
    }

    return this.prisma.sales_round.create({
      data: {
        opening_cash: Number(opening_cash),
        opened_by: employee_id,
        status: 'open'
      }
    });
  }

  async getCurrentRound() {
    const round = await this.prisma.sales_round.findFirst({
      where: { status: 'open' },
      orderBy: { opened_at: 'desc' },
      include: {
        employee_sales_round_opened_byToemployee: { select: { username: true } },
        employee_sales_round_closed_byToemployee: { select: { username: true } },
      }
    });

    if (!round) return null;

    return {
      ...round,
      opened_by_username: round.employee_sales_round_opened_byToemployee?.username || null,
      closed_by_username: round.employee_sales_round_closed_byToemployee?.username || null
    };
  }


  async closeRound(user: any, roundId: number, body: any) {
    const { closing_cash, notes } = body;
    const employee_id = user.employee_id;

    const round = await this.prisma.sales_round.findFirst({
      where: { round_id: roundId, status: 'open' }
    });

    if (!round) {
      throw new NotFoundException('ไม่พบรอบการขายที่เปิดอยู่');
    }

    const sales = await this.prisma.sale.findMany({
      where: { 
        sale_datetime: { gte: round.opened_at },
        status: { not: 'VOIDED' }
      },
      select: { net_total: true, payment_method: true }
    });

    let total_sales = 0;
    let cash_sales = 0;
    let credit_card_sales = 0;
    let qr_sales = 0;
    const total_transactions = sales.length;

    for (const sale of sales) {
      const amount = Number(sale.net_total || 0);
      total_sales += amount;
      if (sale.payment_method === 'Cash') cash_sales += amount;
      else if (sale.payment_method === 'Credit Card') credit_card_sales += amount;
      else if (sale.payment_method === 'QR') qr_sales += amount;
    }

    const expected_cash = Number(round.opening_cash) + cash_sales;
    const cash_difference = closing_cash ? Number(closing_cash) - expected_cash : 0;

    return this.prisma.sales_round.update({
      where: { round_id: roundId },
      data: {
        status: 'closed',
        closed_at: new Date(),
        closed_by: employee_id,
        closing_cash: closing_cash ? Number(closing_cash) : null,
        total_sales,
        cash_sales,
        credit_card_sales,
        qr_sales,
        total_transactions,
        expected_cash,
        cash_difference,
        notes: notes || null
      }
    });
  }


  async listRounds(query: any) {
    const limit = Number(query.limit) || 50;
    const offset = Number(query.offset) || 0;

    const rounds = await this.prisma.sales_round.findMany({
      skip: offset,
      take: limit,
      orderBy: { opened_at: 'desc' },
      include: {
        employee_sales_round_opened_byToemployee: { select: { username: true } },
        employee_sales_round_closed_byToemployee: { select: { username: true } },
      }
    });

    return rounds.map(sr => ({
      ...sr,
      opened_by_username: sr.employee_sales_round_opened_byToemployee?.username || null,
      closed_by_username: sr.employee_sales_round_closed_byToemployee?.username || null
    }));
  }


  async getRoundById(roundId: number) {
    const round = await this.prisma.sales_round.findUnique({
      where: { round_id: roundId },
      include: {
        employee_sales_round_opened_byToemployee: { select: { username: true } },
        employee_sales_round_closed_byToemployee: { select: { username: true } },
      }
    });

    if (!round) {
      throw new NotFoundException('ไม่พบรอบการขาย');
    }

    return {
      ...round,
      opened_by_username: round.employee_sales_round_opened_byToemployee?.username || null,
      closed_by_username: round.employee_sales_round_closed_byToemployee?.username || null
    };
  }


  async getRoundAnalytics(roundId: number) {
    const round = await this.getRoundById(roundId);
    
    const sales = await this.prisma.sale.findMany({
      where: { 
        round_id: roundId,
        status: { not: 'VOIDED' }
      },
      include: {
        sale_item: {
          include: {
            menu: {
              include: {
                pos_category: true
              }
            }
          }
        }
      }
    });

    let totalSales = 0;
    const totalOrders = sales.length;

    const hourlySalesMap = new Map<string, number>();
    const topProductsMap = new Map<number, { name: string; quantity: number; revenue: number }>();
    const categorySplitMap = new Map<string, number>();
    const paymentSplitMap = new Map<string, number>();

    for (const sale of sales) {
      const net = Number(sale.net_total || 0);
      totalSales += net;

      // Payment Split
      const pm = sale.payment_method || 'Unknown';
      paymentSplitMap.set(pm, (paymentSplitMap.get(pm) || 0) + net);

      // Hourly Sales
      const targetDate = sale.sale_datetime || new Date();
      // Format to HH:00
      const hourKey = `${targetDate.getHours().toString().padStart(2, '0')}:00`;
      hourlySalesMap.set(hourKey, (hourlySalesMap.get(hourKey) || 0) + net);

      // Items processing
      for (const item of sale.sale_item) {
        const qty = Number(item.quantity || 0);
        const revenue = Number(item.unit_price || 0) * qty;
        
        // Top Products
        if (item.menu_id && item.menu?.menu_name) {
          const mId = item.menu_id;
          const current = topProductsMap.get(mId) || { name: item.menu.menu_name, quantity: 0, revenue: 0 };
          current.quantity += qty;
          current.revenue += revenue;
          topProductsMap.set(mId, current);
        }

        // Category Split
        const catName = item.menu?.pos_category?.category_name || 'Uncategorized';
        categorySplitMap.set(catName, (categorySplitMap.get(catName) || 0) + revenue);
      }
    }

    const avgBasketValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Format output
    const hourlySales = Array.from(hourlySalesMap.entries())
      .map(([time, revenue]) => ({ time, revenue }))
      .sort((a, b) => a.time.localeCompare(b.time));

    const topProducts = Array.from(topProductsMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const categorySplit = Array.from(categorySplitMap.entries())
      .map(([name, value]) => ({ name, value }));
      
    const paymentSplit = Array.from(paymentSplitMap.entries())
      .map(([name, value]) => ({ name, value }));

    return {
      roundInfo: round,
      metrics: {
        totalSales,
        totalOrders,
        avgBasketValue
      },
      hourlySales,
      topProducts,
      categorySplit,
      paymentSplit
    };
  }
}
