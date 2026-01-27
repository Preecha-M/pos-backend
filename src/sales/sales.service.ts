import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class SalesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(user: any, body: any) {
    const employee_id = user.employee_id;
    const {
      member_id,
      promotion_id,
      payment_method,
      discount_amount,
      items,
    } = body || {};

    /* ---------- 1. Validate ---------- */
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items required');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      /* ---------- 2. Load menu prices ---------- */
      const menuIds = items
        .map((i: any) => Number(i.menu_id))
        .filter(Number.isFinite);

      const menusRes = await client.query(
        `SELECT menu_id, price FROM menu WHERE menu_id = ANY($1::int[])`,
        [menuIds],
      );

      const priceMap = new Map<number, number>(
        menusRes.rows.map((m) => [m.menu_id, Number(m.price)]),
      );

      /* ---------- 3. Prepare sale items ---------- */
      let subtotal = 0;

      const preparedItems = items.map((it: any) => {
        const quantity = Number(it.quantity || 0);
        if (quantity <= 0) {
          throw new BadRequestException('quantity must be greater than 0');
        }

        const unit_price =
          it.unit_price !== undefined
            ? Number(it.unit_price)
            : priceMap.get(Number(it.menu_id)) ?? 0;

        if (unit_price <= 0) {
          throw new BadRequestException('invalid unit_price');
        }

        subtotal += unit_price * quantity;

        return {
          menu_id: Number(it.menu_id),
          quantity,
          unit_price,
        };
      });

      /* ---------- 4. Calculate totals ---------- */
      const discount = Number(discount_amount || 0);
      const net_total = subtotal - discount;

      if (net_total < 0) {
        throw new BadRequestException('net_total cannot be negative');
      }

      /* ---------- 5. Insert SALE ---------- */
      const saleRes = await client.query(
        `INSERT INTO sale
          (subtotal, discount_amount, net_total, payment_method,
           employee_id, member_id, promotion_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          subtotal,
          discount,
          net_total,
          payment_method || 'Cash',
          employee_id,
          member_id ?? null,
          promotion_id ?? null,
        ],
      );

      const sale = saleRes.rows[0];

      /* ---------- 6. Insert SALE_ITEM ---------- */
      for (const it of preparedItems) {
        await client.query(
          `INSERT INTO sale_item
            (sale_id, menu_id, quantity, unit_price)
           VALUES ($1,$2,$3,$4)`,
          [sale.sale_id, it.menu_id, it.quantity, it.unit_price],
        );
      }

      /* ---------- 7. Add MEMBER points ---------- */
      if (member_id) {
        // กติกาแต้ม: ทุก 100 บาท = 1 แต้ม
        const earnedPoints = Math.floor(net_total / 100);

        if (earnedPoints > 0) {
          await client.query(
            `UPDATE member
             SET points = COALESCE(points, 0) + $1
             WHERE member_id = $2`,
            [earnedPoints, member_id],
          );
        }
      }

      await client.query('COMMIT');
      return { ...sale, items: preparedItems };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /* ================== LIST ================== */

  // async list(query: any) {
  //   const salesRes = await this.pool.query(
  //     `SELECT s.*, e.username AS employee_username,
  //             m.name AS member_name, p.promotion_name
  //      FROM sale s
  //      LEFT JOIN employee e ON e.employee_id = s.employee_id
  //      LEFT JOIN member m ON m.member_id = s.member_id
  //      LEFT JOIN promotion p ON p.promotion_id = s.promotion_id
  //      ORDER BY s.sale_id DESC`,
  //   );

  //   const itemsRes = await this.pool.query(
  //     `SELECT si.*, mn.menu_name
  //      FROM sale_item si
  //      LEFT JOIN menu mn ON mn.menu_id = si.menu_id
  //      ORDER BY si.sale_item_id ASC`,
  //   );

  //   const map = new Map<number, any>();
  //   for (const s of salesRes.rows) {
  //     map.set(s.sale_id, { ...s, items: [] });
  //   }

  //   for (const it of itemsRes.rows) {
  //     const holder = map.get(it.sale_id);
  //     if (holder) holder.items.push(it);
  //   }

  //   return [...map.values()];
  // }

async list(query: any) {
  const conditions: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const { mode, month } = query || {};

  /* ================== VALIDATE MODE ================== */
  const allowedModes = ['month', 'year', 'custom'];
  if (mode && !allowedModes.includes(mode)) {
    throw new BadRequestException(
      `Invalid mode. Allowed: ${allowedModes.join(', ')}`,
    );
  }

  /* ================== DATE FILTER ================== */

  if (mode === 'month') {
    conditions.push(
      `date_trunc('month', s.sale_datetime) = date_trunc('month', now())`,
    );
  }

  if (mode === 'year') {
    conditions.push(
      `date_trunc('year', s.sale_datetime) = date_trunc('year', now())`,
    );
  }

  if (mode === 'custom') {
    if (!month) {
      throw new BadRequestException('month is required when mode=custom');
    }

    // month ต้องเป็น YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException(
        'Invalid month format. Expected YYYY-MM',
      );
    }

    conditions.push(
      `date_trunc('month', s.sale_datetime) = date_trunc('month', $${idx}::date)`,
    );
    values.push(`${month}-01`);
    idx++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  /* ================== SALES ================== */
  const salesRes = await this.pool.query(
    `
    SELECT s.*,
           e.username AS employee_username,
           m.name AS member_name,
           p.promotion_name
    FROM sale s
    LEFT JOIN employee e ON e.employee_id = s.employee_id
    LEFT JOIN member m ON m.member_id = s.member_id
    LEFT JOIN promotion p ON p.promotion_id = s.promotion_id
    ${whereClause}
    ORDER BY s.sale_datetime DESC
    `,
    values,
  );

  /* ================== ITEMS ================== */
  const itemsRes = await this.pool.query(
    `
    SELECT si.*, mn.menu_name
    FROM sale_item si
    LEFT JOIN menu mn ON mn.menu_id = si.menu_id
    ORDER BY si.sale_item_id ASC
    `,
  );

  /* ================== MERGE ================== */
  const map = new Map<number, any>();
  for (const s of salesRes.rows) {
    map.set(s.sale_id, { ...s, items: [] });
  }

  for (const it of itemsRes.rows) {
    const holder = map.get(it.sale_id);
    if (holder) holder.items.push(it);
  }

  return [...map.values()];
}


  /* ================== GET BY ID ================== */

  async getById(id: number) {
    const saleRes = await this.pool.query(
      `SELECT s.*, e.username AS employee_username,
              m.name AS member_name, p.promotion_name
       FROM sale s
       LEFT JOIN employee e ON e.employee_id = s.employee_id
       LEFT JOIN member m ON m.member_id = s.member_id
       LEFT JOIN promotion p ON p.promotion_id = s.promotion_id
       WHERE s.sale_id = $1`,
      [id],
    );

    if (!saleRes.rows[0]) {
      throw new NotFoundException('Sale not found');
    }

    const itemsRes = await this.pool.query(
      `SELECT si.*, mn.menu_name
       FROM sale_item si
       LEFT JOIN menu mn ON mn.menu_id = si.menu_id
       WHERE si.sale_id = $1
       ORDER BY si.sale_item_id ASC`,
      [id],
    );

    return { ...saleRes.rows[0], items: itemsRes.rows };
  }

  /* ================== REMOVE ================== */

  async remove(id: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM sale_item WHERE sale_id = $1`, [id]);
      const { rowCount } = await client.query(
        `DELETE FROM sale WHERE sale_id = $1`,
        [id],
      );
      await client.query('COMMIT');

      if (!rowCount) {
        throw new NotFoundException('Sale not found');
      }

      return { message: 'Cancelled (deleted)' };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
