import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles('Admin')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@Query() q: any) {
    return this.dashboardService.summary(q);
  }
}
