import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class IngredientsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list() {
    return this.pool.query(
      `SELECT i.*, c.category_name
       FROM ingredient i
       LEFT JOIN ingredient_category c ON c.category_code=i.category_code
       ORDER BY i.ingredient_id ASC`,
    ).then(r => r.rows);
  }

  create(body: any) {
    return this.pool.query(
      `INSERT INTO ingredient
       (ingredient_id, ingredient_name, unit, cost_per_unit, quantity_on_hand, expire_date, category_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        body.ingredient_id,
        body.ingredient_name || null,
        body.unit || null,
        body.cost_per_unit ?? null,
        body.quantity_on_hand ?? null,
        body.expire_date || null,
        body.category_code || null,
      ],
    ).then(r => r.rows[0]);
  }

  async update(id: string, body: any) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE ingredient
       SET ingredient_name=COALESCE($1, ingredient_name),
           unit=COALESCE($2, unit),
           cost_per_unit=COALESCE($3, cost_per_unit),
           quantity_on_hand=COALESCE($4, quantity_on_hand),
           expire_date=COALESCE($5, expire_date),
           category_code=COALESCE($6, category_code)
       WHERE ingredient_id=$7
       RETURNING *`,
      [
        body.ingredient_name ?? null,
        body.unit ?? null,
        body.cost_per_unit ?? null,
        body.quantity_on_hand ?? null,
        body.expire_date ?? null,
        body.category_code ?? null,
        id,
      ],
    );
    if (!rowCount) throw new NotFoundException('Ingredient not found');
    return rows[0];
  }

  async remove(id: string) {
    const { rowCount } = await this.pool.query(`DELETE FROM ingredient WHERE ingredient_id=$1`, [id]);
    if (!rowCount) throw new NotFoundException('Ingredient not found');
    return { message: 'Deleted' };
  }

  alerts(days = 7) {
    return this.pool.query(
      `SELECT *
       FROM ingredient
       WHERE expire_date IS NOT NULL
         AND expire_date <= (CURRENT_DATE + ($1 || ' days')::interval)
       ORDER BY expire_date ASC`,
      [days],
    ).then(r => r.rows);
  }
}
