import {
  Inject,
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class EmployeesService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  list() {
    return this.pool
      .query(
        `SELECT employee_id, first_name_th, last_name_th, first_name_en, last_name_en,
              phone, birth_date, education, username, role, status
       FROM employee
       ORDER BY employee_id ASC`,
      )
      .then((r) => r.rows);
  }

  async create(body: any) {
    const { username, password } = body || {};
    if (!username || !password)
      throw new BadRequestException('username/password required');

    const hash = await bcrypt.hash(password, 10);

    try {
      const { rows } = await this.pool.query(
        `INSERT INTO employee
          (first_name_th, last_name_th, first_name_en, last_name_en, phone, birth_date, education,
           username, password, role, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING employee_id, username, role, status`,
        [
          body.first_name_th || null,
          body.last_name_th || null,
          body.first_name_en || null,
          body.last_name_en || null,
          body.phone || null,
          body.birth_date || null,
          body.education || null,
          username,
          hash,
          body.role || 'Staff',
          body.status || 'Active',
        ],
      );
      return rows[0];
    } catch (e: any) {
      if (String(e).includes('duplicate key'))
        throw new ConflictException('Username already exists');
      throw e;
    }
  }

  async update(id: number, body: any) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');

    const fields = [
      'first_name_th',
      'last_name_th',
      'first_name_en',
      'last_name_en',
      'phone',
      'birth_date',
      'education',
      'role',
      'status',
    ];

    const set: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const f of fields) {
      if (body[f] !== undefined) {
        set.push(`${f}=$${idx++}`);
        values.push(body[f]);
      }
    }

    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      set.push(`password=$${idx++}`);
      values.push(hash);
    }

    if (set.length === 0) throw new BadRequestException('No fields to update');
    values.push(id);

    const { rowCount, rows } = await this.pool.query(
      `UPDATE employee SET ${set.join(', ')}
       WHERE employee_id=$${idx}
       RETURNING employee_id, username, role, status`,
      values,
    );

    if (!rowCount) throw new NotFoundException('Employee not found');
    return rows[0];
  }

  async resign(id: number) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE employee SET status='Resigned'
       WHERE employee_id=$1
       RETURNING employee_id, username, status`,
      [id],
    );
    if (!rowCount) throw new NotFoundException('Employee not found');
    return rows[0];
  }
}
