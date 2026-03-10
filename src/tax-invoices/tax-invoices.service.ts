import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TaxInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique invoice number: TAX-YYMMDD-NNNN
   */
  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD

    // Count existing invoices for today to create sequential number
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const count = await this.prisma.tax_invoice.count({
      where: {
        created_at: { gte: todayStart, lt: todayEnd },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `TAX-${dateStr}-${seq}`;
  }

  async create(body: any) {
    const {
      sale_id,
      customer_name,
      customer_address,
      customer_tax_id,
      customer_branch,
      store_name,
      store_address,
      store_tax_id,
      store_phone,
      subtotal,
      vat_rate,
      vat_amount,
      total_amount,
      notes,
    } = body || {};

    if (!customer_name) {
      throw new BadRequestException('customer_name is required');
    }
    if (!customer_tax_id) {
      throw new BadRequestException('customer_tax_id is required');
    }
    if (subtotal == null || subtotal < 0) {
      throw new BadRequestException('subtotal is required and must be >= 0');
    }

    // Validate sale_id if provided
    if (sale_id) {
      const sale = await this.prisma.sale.findUnique({
        where: { sale_id: Number(sale_id) },
      });
      if (!sale) {
        throw new NotFoundException('Sale not found');
      }
    }

    const invoice_number = await this.generateInvoiceNumber();

    const computedVatRate = vat_rate ?? 7.0;
    const computedVatAmount = vat_amount ?? Number(subtotal) * (computedVatRate / 100);
    const computedTotal = total_amount ?? Number(subtotal) + computedVatAmount;

    const invoice = await this.prisma.tax_invoice.create({
      data: {
        invoice_number,
        sale_id: sale_id ? Number(sale_id) : null,
        customer_name,
        customer_address: customer_address ?? null,
        customer_tax_id,
        customer_branch: customer_branch ?? null,
        store_name: store_name ?? null,
        store_address: store_address ?? null,
        store_tax_id: store_tax_id ?? null,
        store_phone: store_phone ?? null,
        subtotal: Number(subtotal),
        vat_rate: computedVatRate,
        vat_amount: computedVatAmount,
        total_amount: computedTotal,
        notes: notes ?? null,
      },
    });

    return invoice;
  }

  async list(query: any) {
    const { start_date, end_date, status } = query || {};

    const where: any = {};

    if (start_date && end_date) {
      where.invoice_date = {
        gte: new Date(start_date),
        lte: new Date(end_date),
      };
    } else if (start_date) {
      where.invoice_date = { gte: new Date(start_date) };
    } else if (end_date) {
      where.invoice_date = { lte: new Date(end_date) };
    }

    if (status) {
      where.status = status;
    }

    const invoices = await this.prisma.tax_invoice.findMany({
      where,
      include: {
        sale: {
          select: {
            sale_id: true,
            receipt_number: true,
            net_total: true,
            sale_datetime: true,
            employee: {
              select: {
                first_name_th: true,
                last_name_th: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { invoice_date: 'desc' },
    });

    return invoices.map((inv) => ({
      ...inv,
      employee_name: inv.sale?.employee
        ? `${inv.sale.employee.first_name_th || ''} ${inv.sale.employee.last_name_th || ''}`.trim()
        : null,
      employee_username: inv.sale?.employee?.username || null,
    }));
  }

  async getById(id: number) {
    const invoice = await this.prisma.tax_invoice.findUnique({
      where: { invoice_id: id },
      include: {
        sale: {
          include: {
            employee: {
              select: {
                first_name_th: true,
                last_name_th: true,
                username: true,
              },
            },
            sale_item: {
              include: { menu: { select: { menu_name: true } } },
              orderBy: { sale_item_id: 'asc' },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Tax invoice not found');
    }

    return {
      ...invoice,
      employee_name: invoice.sale?.employee
        ? `${invoice.sale.employee.first_name_th || ''} ${invoice.sale.employee.last_name_th || ''}`.trim()
        : null,
      employee_username: invoice.sale?.employee?.username || null,
    };
  }

  async cancel(id: number) {
    const invoice = await this.prisma.tax_invoice.findUnique({
      where: { invoice_id: id },
    });

    if (!invoice) {
      throw new NotFoundException('Tax invoice not found');
    }

    if (invoice.status === 'CANCELLED') {
      return { message: 'Tax invoice is already cancelled' };
    }

    await this.prisma.tax_invoice.update({
      where: { invoice_id: id },
      data: { status: 'CANCELLED' },
    });

    return { message: 'Tax invoice cancelled successfully' };
  }
}
