import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log('No DATABASE_URL set.');
  process.exit(0);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

await client.connect();
await client.query(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit text;`);
await client.end();
console.log('sale_items table updated with unit column.');
