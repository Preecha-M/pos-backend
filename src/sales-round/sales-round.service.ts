import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class SalesRoundService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}


  async openRound(user: any, body: any) {
    const { opening_cash } = body;
    const employee_id = user.employee_id;

    if (!opening_cash || Number(opening_cash) < 0) {
      throw new BadRequestException('opening_cash must be >= 0');
    }

    const existingRound = await this.pool.query(
      `SELECT * FROM sales_round WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    );

    if (existingRound.rows.length > 0) {
      throw new BadRequestException(
        'มีรอบการขายที่เปิดอยู่แล้ว กรุณาปิดรอบก่อนเปิดรอบใหม่',
      );
    }

    const result = await this.pool.query(
      `INSERT INTO sales_round 
       (opening_cash, opened_by, status)
       VALUES ($1, $2, 'open')
       RETURNING *`,
      [Number(opening_cash), employee_id],
    );

    return result.rows[0];
  }

  async getCurrentRound() {
    const result = await this.pool.query(
      `SELECT sr.*, 
              e1.username as opened_by_username,
              e2.username as closed_by_username
       FROM sales_round sr
       LEFT JOIN employee e1 ON e1.employee_id = sr.opened_by
       LEFT JOIN employee e2 ON e2.employee_id = sr.closed_by
       WHERE sr.status = 'open'
       ORDER BY sr.opened_at DESC
       LIMIT 1`,
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }


  async closeRound(user: any, roundId: number, body: any) {
    const { closing_cash, notes } = body;
    const employee_id = user.employee_id;

    const roundRes = await this.pool.query(
      `SELECT * FROM sales_round WHERE round_id = $1 AND status = 'open'`,
      [roundId],
    );

    if (roundRes.rows.length === 0) {
      throw new NotFoundException('ไม่พบรอบการขายที่เปิดอยู่');
    }

    const round = roundRes.rows[0];

    const salesRes = await this.pool.query(
      `SELECT 
         COUNT(*) as total_transactions,
         COALESCE(SUM(net_total), 0) as total_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN net_total ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'Credit Card' THEN net_total ELSE 0 END), 0) as credit_card_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'QR' THEN net_total ELSE 0 END), 0) as qr_sales
       FROM sale
       WHERE sale_datetime >= $1`,
      [round.opened_at],
    );

    const sales = salesRes.rows[0];
    const expected_cash =
      Number(round.opening_cash) + Number(sales.cash_sales);
    const cash_difference = closing_cash
      ? Number(closing_cash) - expected_cash
      : 0;

    const updateRes = await this.pool.query(
      `UPDATE sales_round
       SET status = 'closed',
           closed_at = NOW(),
           closed_by = $1,
           closing_cash = $2,
           total_sales = $3,
           cash_sales = $4,
           credit_card_sales = $5,
           qr_sales = $6,
           total_transactions = $7,
           expected_cash = $8,
           cash_difference = $9,
           notes = $10
       WHERE round_id = $11
       RETURNING *`,
      [
        employee_id,
        closing_cash || null,
        sales.total_sales,
        sales.cash_sales,
        sales.credit_card_sales,
        sales.qr_sales,
        sales.total_transactions,
        expected_cash,
        cash_difference,
        notes || null,
        roundId,
      ],
    );

    return updateRes.rows[0];
  }


  async listRounds(query: any) {
    const { limit = 50, offset = 0 } = query;

    const result = await this.pool.query(
      `SELECT sr.*,
              e1.username as opened_by_username,
              e2.username as closed_by_username
       FROM sales_round sr
       LEFT JOIN employee e1 ON e1.employee_id = sr.opened_by
       LEFT JOIN employee e2 ON e2.employee_id = sr.closed_by
       ORDER BY sr.opened_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return result.rows;
  }


  async getRoundById(roundId: number) {
    const result = await this.pool.query(
      `SELECT sr.*,
              e1.username as opened_by_username,
              e2.username as closed_by_username
       FROM sales_round sr
       LEFT JOIN employee e1 ON e1.employee_id = sr.opened_by
       LEFT JOIN employee e2 ON e2.employee_id = sr.closed_by
       WHERE sr.round_id = $1`,
      [roundId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('ไม่พบรอบการขาย');
    }

    return result.rows[0];
  }
}
