import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const employees = await this.prisma.employee.findMany({
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
        salary: true,
        _count: {
          select: {
            sale: true,
            sales_round_sales_round_opened_byToemployee: true,
          },
        },
      },
      orderBy: { employee_id: 'asc' },
    });

    return employees.map(e => ({
      ...e,
      salary: e.salary != null ? Number(e.salary) : null,
      total_sales: e._count.sale,
      total_shifts: e._count.sales_round_sales_round_opened_byToemployee,
      _count: undefined,
    }));
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
          salary: body.salary != null && body.salary !== '' ? Number(body.salary) : null,
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

  async update(id: number, body: any, currentUser: any) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');

    // Role Hierarchy Check
    const target = await this.prisma.employee.findUnique({ where: { employee_id: id } });
    if (!target) throw new NotFoundException('Employee not found');

    const targetRole = target.role;
    const currentRole = currentUser.role;

    if (currentRole !== 'Admin') {
      if (targetRole === 'Admin') {
         throw new ForbiddenException('You cannot modify an Admin account.');
      }
      if (currentRole === 'Owner' && targetRole === 'Owner' && target.employee_id !== currentUser.employee_id) {
         throw new ForbiddenException('Owners cannot modify other Owner accounts.');
      }
    }

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
    if (body.salary !== undefined) data.salary = body.salary !== '' && body.salary != null ? Number(body.salary) : null;

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

  async resign(id: number, currentUser: any) {
    // Role Hierarchy Check
    const target = await this.prisma.employee.findUnique({ where: { employee_id: id } });
    if (!target) throw new NotFoundException('Employee not found');

    const targetRole = target.role;
    const currentRole = currentUser.role;

    if (currentRole !== 'Admin') {
      if (targetRole === 'Admin') {
         throw new ForbiddenException('You cannot modify an Admin account.');
      }
      if (currentRole === 'Owner' && targetRole === 'Owner' && target.employee_id !== currentUser.employee_id) {
         throw new ForbiddenException('Owners cannot modify other Owner accounts.');
      }
    }

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
