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
      where: { sale_datetime: { gte: round.opened_at } },
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
}
