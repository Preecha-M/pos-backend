import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TaxInvoicesService } from './tax-invoices.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tax-invoices')
@UseGuards(AuthGuard)
export class TaxInvoicesController {
  constructor(private readonly service: TaxInvoicesService) {}

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(Number(id));
  }

  @Patch(':id/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  cancel(@Param('id') id: string) {
    return this.service.cancel(Number(id));
  }
}
