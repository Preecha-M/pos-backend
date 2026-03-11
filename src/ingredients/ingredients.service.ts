import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';

@Injectable()
export class IngredientsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { is_active: true },
      include: {
        ingredient_category: {
          select: { category_name: true }
        },
        ingredient_batch: {
          orderBy: { expire_date: 'asc' }
        }
      },
      orderBy: { ingredient_id: 'asc' }
    });
    
    return ingredients.map(i => ({
      ...i,
      category_name: i.ingredient_category?.category_name || null
    }));
  }

  async create(dto: CreateIngredientDto) {
    return this.prisma.$transaction(async (tx) => {
      const quantityOnHand = dto.quantity_on_hand ? Number(dto.quantity_on_hand) : null;
      
      const ingredient = await tx.ingredient.create({
        data: {
          ingredient_id: dto.ingredient_id,
          ingredient_name: dto.ingredient_name || null,
          unit: dto.unit || null,
          cost_per_unit: dto.cost_per_unit ?? null,
          quantity_on_hand: quantityOnHand,
          category_code: dto.category_code || null,
        }
      });

      if (quantityOnHand && quantityOnHand > 0) {
        await tx.ingredient_batch.create({
          data: {
            ingredient_id: ingredient.ingredient_id,
            quantity_on_hand: quantityOnHand,
            expire_date: dto.expire_date ? new Date(dto.expire_date) : null,
            cost_per_unit: dto.cost_per_unit ?? null
          }
        });

        await tx.inventory_transaction.create({
          data: {
            ingredient_id: ingredient.ingredient_id,
            transaction_type: 'IN',
            quantity: quantityOnHand,
            notes: 'Initial stock on creation'
          }
        });
      }

      return ingredient;
    });
  }

  async update(id: string, dto: UpdateIngredientDto) {
    try {
      return await this.prisma.ingredient.update({
        where: { ingredient_id: id },
        data: {
          ingredient_name: dto.ingredient_name ?? undefined,
          unit: dto.unit ?? undefined,
          cost_per_unit: dto.cost_per_unit ?? undefined,
          quantity_on_hand: dto.quantity_on_hand ?? undefined,
          category_code: dto.category_code ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Ingredient not found');
      throw e;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.ingredient.update({
        where: { ingredient_id: id },
        data: { is_active: false }
      });
      return { message: 'Deactivated' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Ingredient not found');
      throw e;
    }
  }

  async alerts(days = 7) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const batches = await this.prisma.ingredient_batch.findMany({
      where: {
        expire_date: {
          not: null,
          lte: targetDate
        },
        quantity_on_hand: { gt: 0 }
      },
      include: { ingredient: { select: { ingredient_name: true, unit: true } } },
      orderBy: { expire_date: 'asc' }
    });

    const expired = batches.filter(b => new Date(b.expire_date!) < now);
    const expiringSoon = batches.filter(b => new Date(b.expire_date!) >= now);

    return { expired, expiringSoon };
  }

  async getTransactions() {
    return this.prisma.inventory_transaction.findMany({
      orderBy: { transaction_date: 'desc' },
      include: {
        ingredient: { select: { ingredient_name: true, unit: true } },
        employee: { select: { first_name_th: true, last_name_th: true, username: true } }
      }
    });
  }

  async getCategories() {
    return this.prisma.ingredient_category.findMany({
      orderBy: { category_name: 'asc' }
    });
  }

  async createCategory(body: any) {
    let category_code = body.category_code;
    
    if (!category_code) {
      let nextId = 1;
      const lastCat = await this.prisma.ingredient_category.findFirst({
        where: { category_code: { startsWith: 'CAT' } },
        orderBy: { category_code: 'desc' },
      });
      
      if (lastCat) {
        const numPart = lastCat.category_code.replace('CAT', '');
        if (!isNaN(Number(numPart))) {
          nextId = Number(numPart) + 1;
        }
      }
      category_code = `CAT${nextId.toString().padStart(3, '0')}`;
    }

    return this.prisma.ingredient_category.create({
      data: {
        category_code,
        category_name: body.category_name,
        is_active: body.is_active ?? true
      }
    });
  }

  async updateCategory(id: string, body: any) {
    try {
      return await this.prisma.ingredient_category.update({
        where: { category_code: id },
        data: {
          category_name: body.category_name ?? undefined,
          is_active: body.is_active ?? undefined
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Category not found');
      throw e;
    }
  }

  async removeCategory(id: string) {
    try {
      await this.prisma.ingredient_category.delete({
        where: { category_code: id }
      });
      return { message: 'Deleted' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Category not found');
      if (e.code === 'P2003') throw new BadRequestException('Cannot delete category because it is being used by ingredients');
      throw e;
    }
  }

  async getLowStock(threshold: number = 15) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const ingredients = await this.prisma.ingredient.findMany({
      where: { is_active: true },
      include: {
        ingredient_batch: {
          where: {
            quantity_on_hand: { gt: 0 },
            OR: [
              { expire_date: null },
              { expire_date: { gte: now } }
            ]
          }
        }
      },
      orderBy: { ingredient_id: 'asc' }
    });

    return ingredients
      .map(i => ({
        ...i,
        validStock: i.ingredient_batch.reduce((sum, b) => sum + b.quantity_on_hand, 0)
      }))
      .filter(i => i.validStock < threshold)
      .map(i => ({
        ingredient_id: i.ingredient_id,
        ingredient_name: i.ingredient_name,
        unit: i.unit,
        quantity_on_hand: i.validStock
      }))
      .sort((a, b) => a.quantity_on_hand - b.quantity_on_hand);
  }
}
