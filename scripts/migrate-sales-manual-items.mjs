import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`ALTER TABLE sale_items ALTER COLUMN item_id DROP NOT NULL;
    ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS item_name text;
    ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
    UPDATE sale_items s SET item_name = i.name FROM items i WHERE s.item_id = i.id AND s.item_name IS NULL;
    UPDATE sale_items SET item_name = upper(item_name) WHERE item_name IS DISTINCT FROM upper(item_name);`);
  await client.query('COMMIT');
  console.log('Sales manual item fields are ready.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
