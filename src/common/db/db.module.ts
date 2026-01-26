import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');
        if (!connectionString) {
          throw new Error('DATABASE_URL is not defined');
        }

        const caPath = path.resolve('certs/aiven-ca.pem');

        if (!fs.existsSync(caPath)) {
          throw new Error(`CA file not found at ${caPath}`);
        }

        const ca = fs.readFileSync(caPath, 'utf8');

        return new Pool({
          connectionString,
          ssl: {
            ca,
            rejectUnauthorized: true, // 🔐 ใช้ CA จริง
          },
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
