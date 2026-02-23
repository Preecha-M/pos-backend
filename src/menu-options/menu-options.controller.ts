import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { MenuOptionsService } from './menu-options.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('menu-options')
@UseGuards(AuthGuard)
export class MenuOptionsController {
  constructor(private readonly service: MenuOptionsService) {}

  @Get('groups')
  listGroups() {
    return this.service.listGroups();
  }

  @Post('groups')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  createGroup(@Body() body: any) {
    return this.service.createGroup(body);
  }

  @Put('groups/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  updateGroup(@Param('id') id: string, @Body() body: any) {
    return this.service.updateGroup(Number(id), body);
  }

  @Delete('groups/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  removeGroup(@Param('id') id: string) {
    return this.service.removeGroup(Number(id));
  }

  @Post('items')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  createItem(@Body() body: any) {
    return this.service.createItem(body);
  }

  @Put('items/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  updateItem(@Param('id') id: string, @Body() body: any) {
    return this.service.updateItem(Number(id), body);
  }

  @Delete('items/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  removeItem(@Param('id') id: string) {
    return this.service.removeItem(Number(id));
  }
}
