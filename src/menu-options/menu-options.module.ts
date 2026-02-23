import { Module } from '@nestjs/common';
import { MenuOptionsService } from './menu-options.service';
import { MenuOptionsController } from './menu-options.controller';

@Module({
  providers: [MenuOptionsService],
  controllers: [MenuOptionsController]
})
export class MenuOptionsModule {}
