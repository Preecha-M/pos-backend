import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PG_POOL } from 'src/common/db/db.module';
import type { SignOptions } from 'jsonwebtoken';
import path from 'path';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  cookieOptions() {
    const secure =
      (this.config.get<string>('COOKIE_SECURE') || 'false') === 'true';
    const sameSite = (this.config.get<string>('COOKIE_SAMESITE') ||
      'lax') as any;
    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  async login(username: string, password: string) {
    const client = await this.pool.connect();
    try {
      const q = `SELECT employee_id, username, password, role, status
                 FROM employee WHERE username=$1`;
      const { rows } = await client.query(q, [username]);
      const emp = rows[0];
      if (!emp) throw new UnauthorizedException('Invalid credentials');

      if (String(emp.status || '').toLowerCase() === 'resigned') {
        throw new UnauthorizedException('Employee resigned');
      }

      const ok = await bcrypt.compare(password, emp.password);
      if (!ok) throw new UnauthorizedException('Invalid credentials');

      const expiresIn = (this.config.get<string>('JWT_EXPIRES_IN') ||
        '7d') as SignOptions['expiresIn'];

      const token = this.jwt.sign(
        {
          employee_id: emp.employee_id,
          username: emp.username,
          role: emp.role || 'Staff',
        },
        { expiresIn },
      );

      return {
        token,
        user: {
          employee_id: emp.employee_id,
          username: emp.username,
          role: emp.role,
          status: emp.status,
        },
      };
    } finally {
      client.release();
    }
  }
}
