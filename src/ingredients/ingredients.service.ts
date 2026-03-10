import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

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

  async create(body: any) {
    return this.prisma.$transaction(async (tx) => {
      const quantityOnHand = body.quantity_on_hand ? Number(body.quantity_on_hand) : null;
      
      const ingredient = await tx.ingredient.create({
        data: {
          ingredient_id: body.ingredient_id,
          ingredient_name: body.ingredient_name || null,
          unit: body.unit || null,
          cost_per_unit: body.cost_per_unit ?? null,
          quantity_on_hand: quantityOnHand,
          category_code: body.category_code || null,
        }
      });

      if (quantityOnHand && quantityOnHand > 0) {
        await tx.ingredient_batch.create({
          data: {
            ingredient_id: ingredient.ingredient_id,
            quantity_on_hand: quantityOnHand,
            expire_date: body.expire_date ? new Date(body.expire_date) : null,
            cost_per_unit: body.cost_per_unit ?? null
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

  async update(id: string, body: any) {
    try {
      return await this.prisma.ingredient.update({
        where: { ingredient_id: id },
        data: {
          ingredient_name: body.ingredient_name ?? undefined,
          unit: body.unit ?? undefined,
          cost_per_unit: body.cost_per_unit ?? undefined,
          quantity_on_hand: body.quantity_on_hand ?? undefined,
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

  async withdraw(id: string, quantity: number, employeeId?: number) {
    if (quantity <= 0) throw new BadRequestException('Quantity must be greater than 0');

    // Use transaction to ensure atomicity
    return this.prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ingredient = await tx.ingredient.findUnique({
        where: { ingredient_id: id },
        include: {
          ingredient_batch: {
            where: {
              quantity_on_hand: { gt: 0 },
              OR: [
                { expire_date: null },
                { expire_date: { gte: today } }
              ]
            },
            orderBy: [{ expire_date: 'asc' }, { created_at: 'asc' }]
          }
        }
      });
      
      if (!ingredient) throw new NotFoundException('Ingredient not found');
      
      const totalValidQty = ingredient.ingredient_batch.reduce((sum, b) => sum + b.quantity_on_hand, 0);
      
      if (totalValidQty < quantity) {
        throw new BadRequestException(`Not enough valid/unexpired quantity. Available: ${totalValidQty}, Requested: ${quantity}`);
      }

      let remainingToWithdraw = quantity;

      for (const batch of ingredient.ingredient_batch) {
        if (remainingToWithdraw <= 0) break;

        const qtyToTake = Math.min(batch.quantity_on_hand, remainingToWithdraw);
        
        await tx.ingredient_batch.update({
          where: { batch_id: batch.batch_id },
          data: { quantity_on_hand: { decrement: qtyToTake } }
        });

        remainingToWithdraw -= qtyToTake;
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
          notes: 'Manual withdrawal',
          employee_id: employeeId || null
        }
      });

      return res;
    });
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
