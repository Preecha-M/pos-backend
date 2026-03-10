import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, BadRequestException, Req } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('ingredients')
@UseGuards(AuthGuard)
export class IngredientsController {
  constructor(private readonly service: IngredientsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('alerts')
  alerts(@Query('days') days?: string) {
    const n = Number(days || 7);
    return this.service.alerts(Number.isFinite(n) ? n : 7);
  }

  @Get('categories')
  getCategories() {
    return this.service.getCategories();
  }

  @Post('categories')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  createCategory(@Body() body: any) {
    if (!body?.category_name) throw new BadRequestException('category_name required');
    return this.service.createCategory(body);
  }

  @Put('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.service.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  removeCategory(@Param('id') id: string) {
    return this.service.removeCategory(id);
  }

  @Get('low-stock')
  getLowStock(@Query('threshold') threshold?: string) {
    const t = Number(threshold || 15);
    return this.service.getLowStock(Number.isFinite(t) ? t : 15);
  }

  @Get('transactions')
  getTransactions() {
    return this.service.getTransactions();
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  create(@Body() body: any) {
    if (!body?.ingredient_id) throw new BadRequestException('ingredient_id required');
    return this.service.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/withdraw')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  withdraw(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!body?.quantity) throw new BadRequestException('quantity required');
    return this.service.withdraw(id, Number(body.quantity), req.user?.employee_id);
  }
}
