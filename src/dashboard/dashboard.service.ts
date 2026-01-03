import { Inject, Injectable } from '@nestjs/common';
import { Pool } from "pg"
import { PG_POOL } from '../common/db/db.module';

@Injectable()
export class DashboardService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  
  async summary(q: any) {
    const { from, to } = toDateRange(q);
    
    const [sumRows] = await this.pool.query<any[]>(
      `
      SELECT
        COALESCE(SUM(s.net_total), 0) AS total_revenue,
        COUNT(s.sale_id) AS total_order
      FROM sale s
      WHERE s.sale_datetime BETWEEN ? AND ?
      `,
      [from, to]
    );
    
    const [memRows] = await this.pool.query<any[]>(
      `
      SELECT COUNT(m.member_id) AS total_member
      FROM member as m
      `
    )
    
    return {
      total_revenue: Number(sumRows?.[0].total_revenue || 0),
      total_order: Number(sumRows?.[0].total_order || 0),
      total_member: Number(memRows?.[0].total_member || 0)
    };
  };
}

function toDateRange(q: any) {
  const now = new Date();
  const to = q.to ? new Date(q.to + "T23:59:59.999") : now;
  const from = q.from ? new Date(q.from + "T00:00:00.000") : new Date(to.getTime() - 6 * 86400000);
  return { from, to };
}