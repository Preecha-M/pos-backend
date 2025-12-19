import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class SuppliersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list() {
    return this.pool.query(`SELECT * FROM supplier ORDER BY supplier_id ASC`).then(r => r.rows);
  }

  create(body: any) {
    return this.pool.query(
      `INSERT INTO supplier (supplier_name, contact)
       VALUES ($1,$2) RETURNING *`,
      [body.supplier_name || null, body.contact || null],
    ).then(r => r.rows[0]);
  }
}
