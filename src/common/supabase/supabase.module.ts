import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE = Symbol('SUPABASE');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SUPABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('SUPABASE_URL');
        const key = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
        return createClient(url!, key!);
      },
    },
  ],
  exports: [SUPABASE],
})
export class SupabaseModule {}
