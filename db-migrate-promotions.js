const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE promotion
    ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'AMOUNT',
    ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS min_quantity INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  `);
  console.log('Migration done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
