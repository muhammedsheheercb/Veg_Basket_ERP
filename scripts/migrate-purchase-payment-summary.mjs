import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString:DATABASE_URL, ssl:DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false} });
await client.connect();
try {
  await client.query(`ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS existing_balance numeric(15,3),
    ADD COLUMN IF NOT EXISTS account_paid numeric(15,3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_payment_id uuid`);
  console.log('Purchase payment summaries are ready.');
} finally { await client.end(); }
