import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  cookieOptions() {
    const secure =
      (this.config.get<string>('COOKIE_SECURE') || 'false') === 'true';
    const sameSite = (this.config.get<string>('COOKIE_SAMESITE') ||
      'lax') as any;
    
    // Default to 1 day if not specified
    const maxAge = Number(this.config.get<string>('COOKIE_MAX_AGE_MS')) || 24 * 60 * 60 * 1000;
    
    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge,
    };
  }

  async login(username: string, password: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { username },
      select: { employee_id: true, username: true, password: true, role: true, status: true, first_name_th: true, last_name_th: true }
    });
    
    if (!emp) throw new UnauthorizedException('Invalid credentials');

    if (String(emp.status || '').toLowerCase() === 'resigned') {
      throw new UnauthorizedException('Employee resigned');
    }

    const ok = await bcrypt.compare(password, emp.password || '');
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
        first_name_th: emp.first_name_th,
        last_name_th: emp.last_name_th,
        role: emp.role,
        status: emp.status,
      },
    };
  }
}
