import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.employee.findMany({
      select: {
        employee_id: true,
        first_name_th: true,
        last_name_th: true,
        first_name_en: true,
        last_name_en: true,
        phone: true,
        birth_date: true,
        education: true,
        username: true,
        role: true,
        status: true,
      },
      orderBy: { employee_id: 'asc' },
    });
  }

  async create(body: any) {
    const { username, password } = body || {};
    if (!username || !password)
      throw new BadRequestException('username/password required');

    const hash = await bcrypt.hash(password, 10);

    try {
      return await this.prisma.employee.create({
        data: {
          first_name_th: body.first_name_th || null,
          last_name_th: body.last_name_th || null,
          first_name_en: body.first_name_en || null,
          last_name_en: body.last_name_en || null,
          phone: body.phone || null,
          birth_date: body.birth_date ? new Date(body.birth_date) : null,
          education: body.education || null,
          username,
          password: hash,
          role: body.role || 'Staff',
          status: body.status || 'Active',
        },
        select: {
          employee_id: true,
          username: true,
          role: true,
          status: true,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2002') { // Unique constraint violation in Prisma
        throw new ConflictException('Username already exists');
      }
      throw e;
    }
  }

  async update(id: number, body: any) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');

    const data: any = {};
    if (body.first_name_th !== undefined) data.first_name_th = body.first_name_th;
    if (body.last_name_th !== undefined) data.last_name_th = body.last_name_th;
    if (body.first_name_en !== undefined) data.first_name_en = body.first_name_en;
    if (body.last_name_en !== undefined) data.last_name_en = body.last_name_en;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.birth_date !== undefined) data.birth_date = body.birth_date ? new Date(body.birth_date) : null;
    if (body.education !== undefined) data.education = body.education;
    if (body.role !== undefined) data.role = body.role;
    if (body.status !== undefined) data.status = body.status;

    if (body.password) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('No fields to update');

    try {
      return await this.prisma.employee.update({
        where: { employee_id: id },
        data,
        select: {
          employee_id: true,
          username: true,
          role: true,
          status: true,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') { // Record to update not found
        throw new NotFoundException('Employee not found');
      }
      throw e;
    }
  }

  async resign(id: number) {
    try {
      return await this.prisma.employee.update({
        where: { employee_id: id },
        data: { status: 'Resigned' },
        select: {
          employee_id: true,
          username: true,
          status: true,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') {
        throw new NotFoundException('Employee not found');
      }
      throw e;
    }
  }
}
