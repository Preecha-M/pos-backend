import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.supplier.findMany({
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
}
