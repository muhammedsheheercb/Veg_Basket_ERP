import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query('alter table supplier_payments alter column purchase_id drop not null; alter table customer_payments alter column sale_id drop not null;');
await client.end();
console.log('Opening-balance payments are ready.');
