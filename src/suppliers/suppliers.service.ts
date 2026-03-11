import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.supplier.findMany({
      where: { is_active: true },
      orderBy: { supplier_id: 'asc' }
    });
  }

  async create(body: any) {
    return this.prisma.supplier.create({
      data: {
        supplier_name: body.supplier_name || null,
        contact: body.contact || null,
      }
    });
  }

  async update(id: number, body: any) {
    try {
      return await this.prisma.supplier.update({
        where: { supplier_id: id },
        data: {
          supplier_name: body.supplier_name ?? undefined,
          contact: body.contact ?? undefined,
          is_active: body.is_active ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Supplier not found');
      throw e;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.supplier.update({
        where: { supplier_id: id },
        data: { is_active: false }
      });
      return { message: 'Deactivated' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Supplier not found');
      throw e;
    }
  }
}
