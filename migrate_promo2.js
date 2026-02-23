const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

async function run() {
  const caFilePath = path.join(process.cwd(), 'certs', 'aiven-ca.pem');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: true, 
      ca: fs.readFileSync(caFilePath).toString() 
    }
  });
  
  await client.connect();
  console.log("Connected...");
  try {
    await client.query(`
      ALTER TABLE PROMOTION 
      ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'AMOUNT',
      ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS min_quantity INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
    console.log("Alter table successful!");
  } catch (e) {
    console.error("Migration error:", e);
  } finally {
    await client.end();
  }
}

run();
