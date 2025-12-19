import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class MembersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async search(phone: string) {
    const p = String(phone || '').trim();
    if (!p) return [];
    const { rows } = await this.pool.query(
      `SELECT * FROM member WHERE phone ILIKE $1 ORDER BY member_id ASC`,
      [`%${p}%`],
    );
    return rows;
  }

  async getById(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');
    const { rows } = await this.pool.query(`SELECT * FROM member WHERE member_id=$1`, [id]);
    if (!rows[0]) throw new NotFoundException('Member not found');
    return rows[0];
  }

  create(body: any) {
    return this.pool.query(
      `INSERT INTO member (name, gender, phone, points)
       VALUES ($1,$2,$3,COALESCE($4,0))
       RETURNING *`,
      [body.name || null, body.gender || null, body.phone || null, body.points ?? null],
    ).then(r => r.rows[0]);
  }

  async update(id: number, body: any) {
    const { rowCount, rows } = await this.pool.query(
      `UPDATE member
       SET name=COALESCE($1,name),
           gender=COALESCE($2,gender),
           phone=COALESCE($3,phone),
           points=COALESCE($4,points)
       WHERE member_id=$5
       RETURNING *`,
      [body.name ?? null, body.gender ?? null, body.phone ?? null, body.points ?? null, id],
    );
    if (!rowCount) throw new NotFoundException('Member not found');
    return rows[0];
  }

  async remove(id: number) {
    const { rowCount } = await this.pool.query(`DELETE FROM member WHERE member_id=$1`, [id]);
    if (!rowCount) throw new NotFoundException('Member not found');
    return { message: 'Deleted' };
  }
}
