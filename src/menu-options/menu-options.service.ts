import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MenuOptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups() {
    return this.prisma.menu_option_group.findMany({
      orderBy: { group_id: 'asc' },
      include: {
        menu_option_item: true
      }
    });
  }

  async createGroup(data: any) {
    return this.prisma.menu_option_group.create({
      data: { group_name: data.group_name }
    });
  }

  async updateGroup(id: number, data: any) {
    return this.prisma.menu_option_group.update({
      where: { group_id: id },
      data: { group_name: data.group_name }
    });
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
