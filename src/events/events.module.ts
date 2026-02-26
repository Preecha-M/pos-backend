import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Global()
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway], // Export so other modules (like Sales) can inject and use it
})
export class EventsModule {}
