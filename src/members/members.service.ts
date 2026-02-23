import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(phone: string) {
    const p = String(phone || '').trim();
    if (!p) {
      return this.prisma.member.findMany({
        orderBy: { member_id: 'asc' }
      });
    }
    return this.prisma.member.findMany({
      where: {
        phone: { contains: p, mode: 'insensitive' }
      },
      orderBy: { member_id: 'asc' }
    });
  }

  async getById(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');
    const member = await this.prisma.member.findUnique({
      where: { member_id: id }
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async create(body: any) {
    if (!body.name || !body.phone) {
      throw new BadRequestException('name and phone are required');
    }

    const existing = await this.prisma.member.findFirst({
      where: { phone: body.phone }
    });

    if (existing) {
      throw new BadRequestException('Phone already exists');
    }

    return this.prisma.member.create({
      data: {
        name: body.name,
        gender: body.gender ?? null,
        phone: body.phone,
        points: 0
      }
    });
  }



  async update(id: number, body: any) {
    try {
      return await this.prisma.member.update({
        where: { member_id: id },
        data: {
          name: body.name ?? undefined,
          gender: body.gender ?? undefined,
          phone: body.phone ?? undefined,
          points: body.points ?? undefined,
        }
      });
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Member not found');
      throw e;
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.member.delete({
        where: { member_id: id }
      });
      return { message: 'Deleted' };
    } catch (e: any) {
      if (e.code === 'P2025') throw new NotFoundException('Member not found');
      throw e;
    }
  }
  async addPoints(memberId: number, amount: number) {
    if (!memberId) return null;

    const points = Math.floor(amount / 100); // 100 บาท = 1 แต้ม
    if (points <= 0) return null;

    const res = await this.prisma.member.update({
      where: { member_id: memberId },
      data: {
        points: { increment: points }
      }
    });

    await this.prisma.point_transaction.create({
      data: {
        member_id: memberId,
        points_change: points,
        transaction_type: 'EARN',
        notes: 'Manual points addition'
      }
    });

    return res;
  }

  async getPointsHistory(id: number) {
    if (!Number.isFinite(id)) throw new BadRequestException('Invalid id');
    return this.prisma.point_transaction.findMany({
      where: { member_id: id },
      orderBy: { transaction_date: 'desc' },
      include: {
        sale: { select: { receipt_number: true } }
      }
    });
  }

}
