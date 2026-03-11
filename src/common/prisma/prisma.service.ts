import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // pg-connection-string parses ?sslmode=require as verify-full in pg v8+,
    // overriding any ssl options passed to Pool. Strip it from the URL and
    // set ssl options explicitly instead.
    const dbUrl = new URL(process.env.DATABASE_URL!);
    dbUrl.searchParams.delete('sslmode');

    const pool = new Pool({
      connectionString: dbUrl.toString(),
      ssl: { rejectUnauthorized: false },
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
