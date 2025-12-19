import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class PromotionsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  listActive() {
    return this.pool.query(
      `SELECT *
       FROM promotion
       WHERE (start_date IS NULL OR start_date <= CURRENT_DATE)
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY promotion_id ASC`,
    ).then(r => r.rows);
  }

  create(body: any) {
    return this.pool.query(
      `INSERT INTO promotion (promotion_name, promotion_detail, start_date, end_date)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [body.promotion_name || null, body.promotion_detail || null, body.start_date || null, body.end_date || null],
    ).then(r => r.rows[0]);
  }

  async update(id: number, body: any) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE promotion
       SET promotion_name=COALESCE($1,promotion_name),
           promotion_detail=COALESCE($2,promotion_detail),
           start_date=COALESCE($3,start_date),
           end_date=COALESCE($4,end_date)
       WHERE promotion_id=$5
       RETURNING *`,
      [body.promotion_name ?? null, body.promotion_detail ?? null, body.start_date ?? null, body.end_date ?? null, id],
    );
    if (!rowCount) throw new NotFoundException('Promotion not found');
    return rows[0];
  }

  async remove(id: number) {
    const { rowCount } = await this.pool.query(`DELETE FROM promotion WHERE promotion_id=$1`, [id]);
    if (!rowCount) throw new NotFoundException('Promotion not found');
    return { message: 'Deleted' };
  }
}
