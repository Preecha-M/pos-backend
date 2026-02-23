import { Module } from '@nestjs/common';
import { SalesRoundController } from './sales-round.controller';
import { SalesRoundService } from './sales-round.service';


@Module({
  imports: [],
  controllers: [SalesRoundController],
  providers: [SalesRoundService],
  exports: [SalesRoundService],
})
export class SalesRoundModule {}
