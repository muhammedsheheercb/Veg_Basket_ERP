import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL,
    description text, active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now()
  )`);
  await client.query(`ALTER TABLE purchases ALTER COLUMN total TYPE numeric(14,3), ALTER COLUMN paid TYPE numeric(14,3)`);
  await client.query(`CREATE TABLE IF NOT EXISTS purchase_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_id uuid REFERENCES items(id), item_name text NOT NULL, position integer NOT NULL DEFAULT 0,
    quantity numeric(14,3) NOT NULL, unit text, unit_price numeric(15,3) NOT NULL, line_total numeric(15,3) NOT NULL
  )`);
  console.log('Purchase item rows are ready.');
} finally { await client.end(); }
