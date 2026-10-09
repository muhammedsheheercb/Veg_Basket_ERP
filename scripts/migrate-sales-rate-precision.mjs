import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`ALTER TABLE sale_items
    ALTER COLUMN unit_price TYPE numeric(15,3),
    ALTER COLUMN line_total TYPE numeric(15,3);
    ALTER TABLE customer_sales
    ALTER COLUMN subtotal TYPE numeric(15,3),
    ALTER COLUMN discount TYPE numeric(15,3),
    ALTER COLUMN total TYPE numeric(15,3),
    ALTER COLUMN paid TYPE numeric(15,3);`);
  await client.query('COMMIT');
  console.log('Sales rates and totals now retain three decimal places.');
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
