import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class MenuService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list() {
    return this.pool.query(
      `SELECT m.*, c.category_name
       FROM menu m
       LEFT JOIN pos_category c ON c.category_id = m.category_id
       ORDER BY m.menu_id ASC`,
    ).then(r => r.rows);
  }

  async getById(id: number) {
    const { rows } = await this.pool.query(`SELECT * FROM menu WHERE menu_id=$1`, [id]);
    if (!rows[0]) throw new NotFoundException('Menu not found');
    return rows[0];
  }

  async create(body: any) {
    const { rows } = await this.pool.query(
      `INSERT INTO menu (menu_name, price, status, category_id, image_url)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [body.menu_name, body.price, body.status || 'Available', body.category_id ?? null, body.image_url ?? null],
    );
    return rows[0];
  }

  async update(id: number, body: any) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE menu
       SET menu_name   = COALESCE($1, menu_name),
           price       = COALESCE($2, price),
           status      = COALESCE($3, status),
           category_id = COALESCE($4, category_id),
           image_url   = COALESCE($5, image_url)
       WHERE menu_id=$6
       RETURNING *`,
      [
        body.menu_name ?? null,
        body.price ?? null,
        body.status ?? null,
        body.category_id ?? null,
        body.image_url ?? null,
        id,
      ],
    );
    if (!rowCount) throw new NotFoundException('Menu not found');
    return rows[0];
  }

  async remove(id: number) {
    const { rowCount } = await this.pool.query(`DELETE FROM menu WHERE menu_id=$1`, [id]);
    if (!rowCount) throw new NotFoundException('Menu not found');
    return { message: 'Deleted' };
  }
}
