import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
@UseGuards(AuthGuard, RolesGuard)
@Roles('Admin', 'Owner')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: Request) {
    return this.service.update(Number(id), body, (req as any).user);
  }

  @Delete(':id')
  resign(@Param('id') id: string, @Req() req: Request) {
    return this.service.resign(Number(id), (req as any).user);
  }
}
