import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class OrdersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listWithItems() {
    const orders = await this.pool.query(
      `SELECT o.*, s.supplier_name
       FROM purchase_order o
       LEFT JOIN supplier s ON s.supplier_id=o.supplier_id
       ORDER BY o.order_id DESC`,
    );

    const items = await this.pool.query(
      `SELECT oi.*, i.ingredient_name, i.unit
       FROM purchase_order_item oi
       LEFT JOIN ingredient i ON i.ingredient_id=oi.ingredient_id
       ORDER BY oi.order_item_id ASC`,
    );

    const map = new Map<number, any>();
    for (const o of orders.rows) map.set(o.order_id, { ...o, items: [] });
    for (const it of items.rows) {
      const holder = map.get(it.order_id);
      if (holder) holder.items.push(it);
    }
    return [...map.values()];
  }

  async create(body: any) {
    const { supplier_id, order_status, items } = body || {};
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('items required');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const orderRes = await client.query(
        `INSERT INTO purchase_order (order_status, supplier_id)
         VALUES ($1,$2)
         RETURNING *`,
        [order_status || 'Pending', supplier_id ?? null],
      );
      const order = orderRes.rows[0];

      for (const it of items) {
        if (!it.ingredient_id || !it.quantity) {
          await client.query('ROLLBACK');
          throw new BadRequestException('ingredient_id and quantity required');
        }
        await client.query(
          `INSERT INTO purchase_order_item (order_id, ingredient_id, quantity, unit_cost)
           VALUES ($1,$2,$3,$4)`,
          [order.order_id, it.ingredient_id, it.quantity, it.unit_cost ?? null],
        );
      }

      if (String(order.order_status).toLowerCase() === 'received') {
        for (const it of items) {
          await client.query(
            `UPDATE ingredient
             SET quantity_on_hand = COALESCE(quantity_on_hand,0) + $1
             WHERE ingredient_id=$2`,
            [it.quantity, it.ingredient_id],
          );
        }
      }

      await client.query('COMMIT');
      return { ...order, items };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
