import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class PromotionsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listActive() {
    const res = await this.pool.query(
      `SELECT p.*, COALESCE(json_agg(pm.menu_id) FILTER (WHERE pm.menu_id IS NOT NULL), '[]') as menu_ids
       FROM promotion p
       LEFT JOIN promotion_menu pm ON p.promotion_id = pm.promotion_id
       WHERE (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
         AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
         AND COALESCE(p.is_active, TRUE) = TRUE
       GROUP BY p.promotion_id
       ORDER BY p.promotion_id ASC`,
    );
    return res.rows;
  }

  async listAll() {
    const res = await this.pool.query(
      `SELECT p.*, COALESCE(json_agg(pm.menu_id) FILTER (WHERE pm.menu_id IS NOT NULL), '[]') as menu_ids
       FROM promotion p
       LEFT JOIN promotion_menu pm ON p.promotion_id = pm.promotion_id
       WHERE COALESCE(p.is_active, TRUE) = TRUE
       GROUP BY p.promotion_id
       ORDER BY p.promotion_id DESC`,
    );
    return res.rows;
  }

  async migrate() {
    await this.pool.query(`
      ALTER TABLE PROMOTION 
      ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'AMOUNT',
      ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS min_quantity INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
    return { success: true };
  }

  async create(body: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        `INSERT INTO promotion (promotion_name, promotion_detail, start_date, end_date, discount_type, discount_value, min_quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          body.promotion_name || null,
          body.promotion_detail || null,
          body.start_date || null,
          body.end_date || null,
          body.discount_type || 'AMOUNT',
          body.discount_value || 0,
          body.min_quantity || 1
        ],
      );
      const promo = res.rows[0];

      if (Array.isArray(body.menu_ids) && body.menu_ids.length > 0) {
        for (const mid of body.menu_ids) {
          await client.query(
            `INSERT INTO promotion_menu (promotion_id, menu_id) VALUES ($1, $2)`,
            [promo.promotion_id, mid]
          );
        }
        promo.menu_ids = body.menu_ids;
      } else {
        promo.menu_ids = [];
      }

      await client.query('COMMIT');
      return promo;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id: number, body: any) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rowCount, rows } = await client.query(
        `UPDATE promotion
         SET promotion_name=COALESCE($1,promotion_name),
             promotion_detail=COALESCE($2,promotion_detail),
             start_date=COALESCE($3,start_date),
             end_date=COALESCE($4,end_date),
             discount_type=COALESCE($5,discount_type),
             discount_value=COALESCE($6,discount_value),
             min_quantity=COALESCE($7,min_quantity)
         WHERE promotion_id=$8
         RETURNING *`,
        [
          body.promotion_name ?? null, 
          body.promotion_detail ?? null, 
          body.start_date ?? null, 
          body.end_date ?? null, 
          body.discount_type ?? null,
          body.discount_value ?? null,
          body.min_quantity ?? null,
          id
        ],
      );
      if (!rowCount) {
        await client.query('ROLLBACK');
        throw new NotFoundException('Promotion not found');
      }
      const promo = rows[0];

      if (body.menu_ids && Array.isArray(body.menu_ids)) {
        await client.query(`DELETE FROM promotion_menu WHERE promotion_id=$1`, [id]);
        for (const mid of body.menu_ids) {
          await client.query(
            `INSERT INTO promotion_menu (promotion_id, menu_id) VALUES ($1, $2)`,
            [id, mid]
          );
        }
        promo.menu_ids = body.menu_ids;
      }

      await client.query('COMMIT');
      return promo;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async remove(id: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(`UPDATE promotion SET is_active=FALSE WHERE promotion_id=$1`, [id]);
      if (!rowCount) {
        await client.query('ROLLBACK');
        throw new NotFoundException('Promotion not found');
      }
      await client.query('COMMIT');
      return { message: 'Deleted' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
