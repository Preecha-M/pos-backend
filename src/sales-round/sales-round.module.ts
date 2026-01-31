import { Module } from '@nestjs/common';
import { SalesRoundController } from './sales-round.controller';
import { SalesRoundService } from './sales-round.service';
import { DbModule } from '../common/db/db.module';

@Module({
  imports: [DbModule],
  controllers: [SalesRoundController],
  providers: [SalesRoundService],
  exports: [SalesRoundService],
})
export class SalesRoundModule {}
