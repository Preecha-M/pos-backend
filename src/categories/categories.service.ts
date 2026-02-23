import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.pos_category.findMany({
      select: {
        category_id: true,
        category_name: true,
        icon: true,
        position: true,
        is_active: true,
      },
      orderBy: [
        { position: 'asc' },
        { category_id: 'asc' }
      ],
    });
  }

  async create(body: any) {
    return this.prisma.pos_category.create({
      data: {
        category_name: body.category_name,
        icon: body.icon || null,
        position: body.position ?? 1,
        is_active: body.is_active ?? true,
      }
    });
  }

  async update(id: number, body: any) {
    try {
      return await this.prisma.pos_category.update({
        where: { category_id: id },
        data: {
          category_name: body.category_name ?? undefined,
          icon: body.icon ?? undefined,
          position: body.position ?? undefined,
          is_active: body.is_active ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Category not found');
      throw e;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.pos_category.update({
        where: { category_id: id },
        data: { is_active: false }
      });
      return { message: 'Deleted' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Category not found');
      throw e;
    }
  }
}
