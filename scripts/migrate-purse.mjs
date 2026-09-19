import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS purse_additions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    amount numeric(14,2) NOT NULL,
    method text NOT NULL,
    date date NOT NULL,
    description text,
    created_at timestamp NOT NULL DEFAULT now()
  );
`);

await client.end();
console.log('Purse additions table migration completed.');
