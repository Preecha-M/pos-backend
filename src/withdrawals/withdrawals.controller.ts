import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('withdrawals')
@UseGuards(AuthGuard, RolesGuard)
@Roles('Admin', 'Owner', 'Manager')
export class WithdrawalsController {
  constructor(private readonly service: WithdrawalsService) {}

  @Post()
  create(@Body() dto: CreateWithdrawalDto, @Req() req: any) {
    return this.service.create(dto, req.user?.employee_id);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }
}
