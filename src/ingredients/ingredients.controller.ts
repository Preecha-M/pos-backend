import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, BadRequestException } from '@nestjs/common';
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

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  create(@Body() body: any) {
    if (!body?.ingredient_id) throw new BadRequestException('ingredient_id required');
    return this.service.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
