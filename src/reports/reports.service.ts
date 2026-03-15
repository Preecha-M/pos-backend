import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * สรุปรายได้และค่าใช้จ่ายต่อเดือน
   * - รายได้: ยอดขาย (sale.net_total) ในเดือนที่เลือก
   * - ค่าใช้จ่ายสั่งของ: ยอดใบสั่งซื้อ (purchase_order.total_amount) ในเดือนที่เลือก
   * - ค่าใช้จ่ายเงินเดือน: ผลรวมเงินเดือนพนักงาน Active (ใช้ค่าปัจจุบัน)
   */
  async getMonthlySummary(year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    // รายได้: sum net_total จาก sale ในเดือนนี้ (status COMPLETED)
    const sales = await this.prisma.sale.aggregate({
      where: {
        sale_datetime: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
        status: 'COMPLETED',
      },
      _sum: { net_total: true },
    });
    const revenue = Number(sales._sum.net_total ?? 0);

    // ค่าใช้จ่ายสั่งของ: sum total_amount จาก purchase_order ในเดือนนี้
    const orders = await this.prisma.purchase_order.aggregate({
      where: {
        order_date: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: { total_amount: true },
    });
    const expensePurchase = Number(orders._sum.total_amount ?? 0);

    // ค่าใช้จ่ายเงินเดือน: sum salary ของพนักงาน Active (ต้นทุนรายเดือนคงที่)
    const employees = await this.prisma.employee.aggregate({
      where: { status: 'Active' },
      _sum: { salary: true },
    });
    const expenseSalary = Number(employees._sum.salary ?? 0);

    const totalExpense = expensePurchase + expenseSalary;
    const profit = revenue - totalExpense;

    return {
      year,
      month,
      revenue,
      expensePurchase,
      expenseSalary,
      totalExpense,
      profit,
    };
  }
}
