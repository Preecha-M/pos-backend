import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWithdrawalDto, employeeId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Generate WD number: WD-YYYYMM-XXXX
      const yearStr = today.getFullYear().toString();
      const monthStr = String(today.getMonth() + 1).padStart(2, '0');
      const prefix = `WD-${yearStr}${monthStr}-`;

      const lastWd = await tx.withdrawal_request.findFirst({
        where: { wd_number: { startsWith: prefix } },
        orderBy: { wd_number: 'desc' },
        select: { wd_number: true },
      });

      let nextIndex = 1;
      if (lastWd?.wd_number) {
        const lastIndexStr = lastWd.wd_number.replace(prefix, '');
        const parsed = parseInt(lastIndexStr, 10);
        if (!isNaN(parsed)) nextIndex = parsed + 1;
      }
      const wdNumber = `${prefix}${String(nextIndex).padStart(4, '0')}`;

      // Validate all items have enough stock before deducting
      for (const item of dto.items) {
        const ingredient = await tx.ingredient.findUnique({
          where: { ingredient_id: item.ingredient_id },
          include: {
            ingredient_batch: {
              where: {
                quantity_on_hand: { gt: 0 },
                OR: [
                  { expire_date: null },
                  { expire_date: { gte: today } },
                ],
              },
              orderBy: [{ expire_date: 'asc' }, { created_at: 'asc' }],
            },
          },
        });

        if (!ingredient) {
          throw new NotFoundException(`Ingredient ${item.ingredient_id} not found`);
        }

        const totalValid = ingredient.ingredient_batch.reduce(
          (sum, b) => sum + b.quantity_on_hand, 0,
        );

        if (totalValid < item.quantity) {
          throw new BadRequestException(
            `Not enough stock for ${ingredient.ingredient_name || item.ingredient_id}. Available: ${totalValid}, Requested: ${item.quantity}`,
          );
        }
      }

      // Create the withdrawal request document
      const withdrawal = await tx.withdrawal_request.create({
        data: {
          wd_number: wdNumber,
          status: 'Completed',
          notes: dto.notes || null,
          employee_id: employeeId || null,
        },
      });

      // Process each item: FIFO batch deduction
      for (const item of dto.items) {
        await tx.withdrawal_request_item.create({
          data: {
            withdrawal_id: withdrawal.withdrawal_id,
            ingredient_id: item.ingredient_id,
            quantity: item.quantity,
          },
        });

        const batches = await tx.ingredient_batch.findMany({
          where: {
            ingredient_id: item.ingredient_id,
            quantity_on_hand: { gt: 0 },
            OR: [
              { expire_date: null },
              { expire_date: { gte: today } },
            ],
          },
          orderBy: [{ expire_date: 'asc' }, { created_at: 'asc' }],
        });

        let remaining = item.quantity;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const qtyToTake = Math.min(batch.quantity_on_hand, remaining);
          await tx.ingredient_batch.update({
            where: { batch_id: batch.batch_id },
            data: { quantity_on_hand: { decrement: qtyToTake } },
          });
          remaining -= qtyToTake;
        }

        // Sync ingredient.quantity_on_hand from batch totals
        const allBatches = await tx.ingredient_batch.findMany({
          where: { ingredient_id: item.ingredient_id, quantity_on_hand: { gt: 0 } },
        });
        const newTotal = allBatches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
        await tx.ingredient.update({
          where: { ingredient_id: item.ingredient_id },
          data: { quantity_on_hand: newTotal },
        });

        // Record inventory transaction
        await tx.inventory_transaction.create({
          data: {
            ingredient_id: item.ingredient_id,
            transaction_type: 'OUT',
            quantity: -item.quantity,
            reference_id: wdNumber,
            notes: dto.notes || 'Withdrawal',
            employee_id: employeeId || null,
          },
        });
      }

      return tx.withdrawal_request.findUnique({
        where: { withdrawal_id: withdrawal.withdrawal_id },
        include: {
          withdrawal_request_item: {
            include: {
              ingredient: { select: { ingredient_name: true, unit: true } },
            },
          },
          employee: {
            select: { first_name_th: true, last_name_th: true, username: true },
          },
        },
      });
    });
  }

  async list() {
    return this.prisma.withdrawal_request.findMany({
      orderBy: { request_date: 'desc' },
      include: {
        withdrawal_request_item: {
          include: {
            ingredient: { select: { ingredient_name: true, unit: true } },
          },
        },
        employee: {
          select: { first_name_th: true, last_name_th: true, username: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const wd = await this.prisma.withdrawal_request.findUnique({
      where: { withdrawal_id: id },
      include: {
        withdrawal_request_item: {
          include: {
            ingredient: { select: { ingredient_name: true, unit: true } },
          },
        },
        employee: {
          select: { first_name_th: true, last_name_th: true, username: true },
        },
      },
    });
    if (!wd) throw new NotFoundException('Withdrawal not found');
    return wd;
  }
}
