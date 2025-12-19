import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const PG_POOL = Symbol('PG_POOL');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');
        const sslMode = connectionString?.includes('sslmode=require');

        return new Pool({
          connectionString,
          ssl: sslMode ? { rejectUnauthorized: false } : undefined,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
