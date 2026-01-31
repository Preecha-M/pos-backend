import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SalesRoundService } from './sales-round.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('sales-round')
@UseGuards(AuthGuard)
export class SalesRoundController {
  constructor(private readonly salesRoundService: SalesRoundService) {}


  @Post('open')
  async openRound(@Request() req, @Body() body: any) {
    return this.salesRoundService.openRound(req.user, body);
  }


  @Get('current')
  async getCurrentRound() {
    return this.salesRoundService.getCurrentRound();
  }


  @Put(':id/close')
  async closeRound(
    @Request() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.salesRoundService.closeRound(req.user, Number(id), body);
  }


  @Get()
  async listRounds(@Query() query: any) {
    return this.salesRoundService.listRounds(query);
  }

  @Get(':id')
  async getRoundById(@Param('id') id: string) {
    return this.salesRoundService.getRoundById(Number(id));
  }
}
