import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MenuOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups() {
    const groups = await this.prisma.menu_option_group.findMany({
      orderBy: { group_id: 'asc' },
      include: {
        menu_option_item: true,
        menu_option_group_menu: {
          select: { menu_id: true }
        }
      }
    });

    return groups.map(g => ({
      ...g,
      menu_ids: g.menu_option_group_menu.map(m => m.menu_id),
      menu_option_group_menu: undefined
    }));
  }

  async createGroup(data: any) {
    const group = await this.prisma.menu_option_group.create({
      data: { group_name: data.group_name }
    });

    if (data.menu_ids && Array.isArray(data.menu_ids)) {
      await this.prisma.menu_option_group_menu.createMany({
        data: data.menu_ids.map((id: number) => ({
          group_id: group.group_id,
          menu_id: Number(id)
        }))
      });
    }

    return group;
  }

  async updateGroup(id: number, data: any) {
    const group = await this.prisma.menu_option_group.update({
      where: { group_id: id },
      data: { group_name: data.group_name }
    });

    if (data.menu_ids && Array.isArray(data.menu_ids)) {
      await this.prisma.$transaction(async (tx) => {
        await tx.menu_option_group_menu.deleteMany({
          where: { group_id: id }
        });
        if (data.menu_ids.length > 0) {
          await tx.menu_option_group_menu.createMany({
            data: data.menu_ids.map((menuId: number) => ({
              group_id: id,
              menu_id: Number(menuId)
            }))
          });
        }
      });
    }

    return group;
  }

  async removeGroup(id: number) {
    return this.prisma.menu_option_group.delete({
      where: { group_id: id }
    });
  }

  async createItem(data: any) {
    return this.prisma.menu_option_item.create({
      data: {
        group_id: Number(data.group_id),
        item_name: data.item_name,
        additional_price: Number(data.additional_price ?? 0)
      }
    });
  }

  async updateItem(id: number, data: any) {
    return this.prisma.menu_option_item.update({
      where: { item_id: id },
      data: {
        item_name: data.item_name ?? undefined,
        additional_price: data.additional_price != null ? Number(data.additional_price) : undefined
      }
    });
  }

  async removeItem(id: number) {
    return this.prisma.menu_option_item.delete({
      where: { item_id: id }
    });
  }
}
