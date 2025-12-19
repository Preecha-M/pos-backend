import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('menu')
@UseGuards(AuthGuard)
export class MenuController {
  constructor(private readonly service: MenuService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    const n = Number(id);
    if (!Number.isFinite(n)) throw new BadRequestException('Invalid id');
    return this.service.getById(n);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  create(@Body() body: any) {
    if (!body?.menu_name || body?.price === undefined) throw new BadRequestException('menu_name and price required');
    return this.service.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
