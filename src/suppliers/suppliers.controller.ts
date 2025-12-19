import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('suppliers')
@UseGuards(AuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }
}
