import { Body, Controller, Get, Post, UseGuards, Put, Param, Req } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('Admin', 'Owner', 'Manager')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list() {
    return this.service.listWithItems();
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create(body, req.user?.employee_id);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.updateStatus(Number(id), body.order_status, body.itemExpiries, req.user?.employee_id);
  }
}
