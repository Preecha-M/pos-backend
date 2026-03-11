import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto, UpdateIngredientDto } from './dto/create-ingredient.dto';
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
  create(@Body() dto: CreateIngredientDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  update(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Owner', 'Manager')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
