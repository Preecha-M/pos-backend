import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true, ca: require('fs').readFileSync('certs/aiven-ca.pem').toString() }
  });
  
  await client.connect();
  console.log("Connected...");
  try {
    await client.query(`
      ALTER TABLE PROMOTION
      ADD COLUMN discount_type VARCHAR(50) DEFAULT 'AMOUNT',
      ADD COLUMN discount_value DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN min_quantity INT DEFAULT 1;
    `);
    console.log("Alter table successful!");
  } catch (e) {
    if (e.message.includes("already exists")) {
      console.log("Columns already exist.");
    } else {
      console.error(e);
    }
  } finally {
    await client.end();
  }
}

run();
