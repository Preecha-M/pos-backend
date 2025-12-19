import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class CategoriesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list() {
    return this.pool
      .query(
        `SELECT category_id, category_name, icon, position, is_active
       FROM pos_category
       ORDER BY position ASC, category_id ASC`,
      )
      .then((r) => r.rows);
  }

  async create(body: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO pos_category (category_name, icon, position, is_active)
       VALUES ($1,$2,COALESCE($3,1),COALESCE($4,TRUE))
       RETURNING *`,
      [
        body.category_name,
        body.icon || null,
        body.position ?? null,
        body.is_active ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: number, body: any) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE pos_category
       SET category_name = COALESCE($1, category_name),
           icon = COALESCE($2, icon),
           position = COALESCE($3, position),
           is_active = COALESCE($4, is_active)
       WHERE category_id=$5
       RETURNING *`,
      [
        body.category_name ?? null,
        body.icon ?? null,
        body.position ?? null,
        body.is_active ?? null,
        id,
      ],
    );
    if (!rowCount) throw new NotFoundException('Category not found');
    return rows[0];
  }

  async remove(id: number) {
    const { rowCount } = await this.pool.query(
      `UPDATE pos_category SET is_active=FALSE WHERE category_id=$1`,
      [id],
    );
    if (!rowCount) throw new NotFoundException('Category not found');
    return { message: 'Deleted' };
  }
}
