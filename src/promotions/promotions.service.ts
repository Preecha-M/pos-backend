import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const promotions = await this.prisma.promotion.findMany({
      where: {
        OR: [{ start_date: null }, { start_date: { lte: today } }],
        AND: [{ OR: [{ end_date: null }, { end_date: { gte: today } }] }]
      },
      include: {
        promotion_menu: { select: { menu_id: true } }
      },
      orderBy: { promotion_id: 'asc' }
    });

    return promotions.map(p => ({
      ...p,
      menu_ids: p.promotion_menu.map(pm => pm.menu_id)
    }));
  }

  async listAll() {
    const promotions = await this.prisma.promotion.findMany({
      include: {
        promotion_menu: { select: { menu_id: true } }
      },
      orderBy: { promotion_id: 'desc' }
    });

    return promotions.map(p => ({
      ...p,
      menu_ids: p.promotion_menu.map(pm => pm.menu_id)
    }));
  }

  async migrate() {
    // Left for backwards compatibility, no-op since Prisma manages schema
    return { success: true };
  }

  async create(body: any) {
    return this.prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({
        data: {
          promotion_name: body.promotion_name || null,
          promotion_detail: body.promotion_detail || null,
          start_date: body.start_date ? new Date(body.start_date) : null,
          end_date: body.end_date ? new Date(body.end_date) : null,
          discount_type: body.discount_type || 'AMOUNT',
          discount_value: body.discount_value !== undefined ? Number(body.discount_value) : 0,
          min_quantity: body.min_quantity !== undefined ? Number(body.min_quantity) : 1,
        }
      });

      let menu_ids = [];
      if (Array.isArray(body.menu_ids) && body.menu_ids.length > 0) {
        menu_ids = body.menu_ids;
        await tx.promotion_menu.createMany({
          data: menu_ids.map(mid => ({
            promotion_id: promo.promotion_id,
            menu_id: mid
          }))
        });
      }

      return { ...promo, menu_ids };
    });
  }

  async update(id: number, body: any) {
    return this.prisma.$transaction(async (tx) => {
      let promo;
      try {
        promo = await tx.promotion.update({
          where: { promotion_id: id },
          data: {
            promotion_name: body.promotion_name ?? undefined,
            promotion_detail: body.promotion_detail ?? undefined,
            start_date: body.start_date !== undefined ? (body.start_date ? new Date(body.start_date) : null) : undefined,
            end_date: body.end_date !== undefined ? (body.end_date ? new Date(body.end_date) : null) : undefined,
            discount_type: body.discount_type ?? undefined,
            discount_value: body.discount_value !== undefined ? Number(body.discount_value) : undefined,
            min_quantity: body.min_quantity !== undefined ? Number(body.min_quantity) : undefined,
          }
        });
      } catch (e: any) {
        if (e.code === 'P2025') throw new NotFoundException('Promotion not found');
        throw e;
      }

      let menu_ids: (number | null)[] = [];
      if (body.menu_ids && Array.isArray(body.menu_ids)) {
        await tx.promotion_menu.deleteMany({ where: { promotion_id: id } });
        menu_ids = body.menu_ids;
        await tx.promotion_menu.createMany({
          data: menu_ids.map(mid => ({
            promotion_id: id,
            menu_id: mid
          }))
        });
      } else {
        const existingMenus = await tx.promotion_menu.findMany({ where: { promotion_id: id }, select: { menu_id: true } });
        menu_ids = existingMenus.map(m => m.menu_id);
      }

      return { ...promo, menu_ids };
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // First delete associated rows in promotion_menu
      await tx.promotion_menu.deleteMany({
        where: { promotion_id: id }
      });
      
      try {
        await tx.promotion.delete({
          where: { promotion_id: id },
        });
        return { message: 'Deleted' };
      } catch (e: any) {
        if (e.code === 'P2025') throw new NotFoundException('Promotion not found');
        throw e;
      }
    });
  }
}
