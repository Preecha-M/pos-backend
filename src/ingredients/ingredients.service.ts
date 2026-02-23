import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const ingredients = await this.prisma.ingredient.findMany({
      include: {
        ingredient_category: {
          select: { category_name: true }
        }
      },
      orderBy: { ingredient_id: 'asc' }
    });
    
    return ingredients.map(i => ({
      ...i,
      category_name: i.ingredient_category?.category_name || null
    }));
  }

  async create(body: any) {
    return this.prisma.ingredient.create({
      data: {
        ingredient_id: body.ingredient_id,
        ingredient_name: body.ingredient_name || null,
        unit: body.unit || null,
        cost_per_unit: body.cost_per_unit ?? null,
        quantity_on_hand: body.quantity_on_hand ?? null,
        expire_date: body.expire_date ? new Date(body.expire_date) : null,
        category_code: body.category_code || null,
      }
    });
  }

  async update(id: string, body: any) {
    try {
      return await this.prisma.ingredient.update({
        where: { ingredient_id: id },
        data: {
          ingredient_name: body.ingredient_name ?? undefined,
          unit: body.unit ?? undefined,
          cost_per_unit: body.cost_per_unit ?? undefined,
          quantity_on_hand: body.quantity_on_hand ?? undefined,
          expire_date: body.expire_date ? new Date(body.expire_date) : undefined,
          category_code: body.category_code ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Ingredient not found');
      throw e;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.ingredient.delete({
        where: { ingredient_id: id }
      });
      return { message: 'Deleted' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Ingredient not found');
      throw e;
    }
  }

  async alerts(days = 7) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.prisma.ingredient.findMany({
      where: {
        expire_date: {
          not: null,
          lte: targetDate
        }
      },
      orderBy: { expire_date: 'asc' }
    });
  }

  async withdraw(id: string, quantity: number) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');

    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.findUnique({
        where: { ingredient_id: id },
        select: { quantity_on_hand: true }
      });
      
      if (!ingredient) throw new NotFoundException('Ingredient not found');
      
      const currentQty = ingredient.quantity_on_hand || 0;
      if (currentQty < quantity) {
        throw new BadRequestException(`Not enough quantity. Current: ${currentQty}, Requested: ${quantity}`);
      }

      const res = await tx.ingredient.update({
        where: { ingredient_id: id },
        data: {
          quantity_on_hand: { decrement: quantity }
        }
      });

      await tx.inventory_transaction.create({
        data: {
          ingredient_id: id,
          transaction_type: 'OUT',
          quantity: -quantity,
          notes: 'Manual withdrawal'
        }
      });

      return res;
    });
  }

  async getTransactions() {
    return this.prisma.inventory_transaction.findMany({
      orderBy: { transaction_date: 'desc' },
      include: {
        ingredient: { select: { ingredient_name: true, unit: true } }
      }
    });
  }
}
