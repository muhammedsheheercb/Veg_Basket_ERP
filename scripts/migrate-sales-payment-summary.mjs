import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`ALTER TABLE customer_sales
    ADD COLUMN IF NOT EXISTS existing_balance numeric(15,3),
    ADD COLUMN IF NOT EXISTS account_paid numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_payment_id uuid;`);
  console.log('Sales invoice payment summary storage is ready.');
} finally { await client.end(); }
