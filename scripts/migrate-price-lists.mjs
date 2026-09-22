import pg from 'pg';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS price_lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), price_list_number text NOT NULL UNIQUE, customer_name text NOT NULL, price_list_date date NOT NULL, grand_total numeric(14,2) NOT NULL, created_at timestamp NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS price_list_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), price_list_id uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE, item_id uuid NOT NULL REFERENCES items(id), quantity text NOT NULL, unit_price numeric(14,2) NOT NULL, line_total numeric(14,2) NOT NULL); ALTER TABLE price_list_items ALTER COLUMN quantity TYPE text USING quantity::text;`);
await client.end();
console.log('Price list tables are ready.');
