import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const menus = await this.prisma.menu.findMany({
      include: {
        pos_category: {
          select: { category_name: true }
        }
      },
      orderBy: { menu_id: 'asc' }
    });
    
    return menus.map(m => ({
      ...m,
      category_name: m.pos_category?.category_name || null
    }));
  }

  async getById(id: number) {
    const menu = await this.prisma.menu.findUnique({
      where: { menu_id: id }
    });
    if (!menu) throw new NotFoundException('Menu not found');
    return menu;
  }

  async create(body: any) {
    return this.prisma.menu.create({
      data: {
        menu_name: body.menu_name,
        price: body.price,
        status: body.status || 'Available',
        category_id: body.category_id ?? null,
        image_url: body.image_url ?? null,
      }
    });
  }

  async update(id: number, body: any) {
    try {
      return await this.prisma.menu.update({
        where: { menu_id: id },
        data: {
          menu_name: body.menu_name ?? undefined,
          price: body.price ?? undefined,
          status: body.status ?? undefined,
          category_id: body.category_id ?? undefined,
          image_url: body.image_url ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Menu not found');
      throw e;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.menu.delete({
        where: { menu_id: id }
      });
      return { message: 'Deleted' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Menu not found');
      throw e;
    }
  }
}
