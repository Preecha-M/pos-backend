import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sales')
@UseGuards(AuthGuard)
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user, body);
  }

  @Get()
  list(@Query() query: any) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(Number(id));
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
