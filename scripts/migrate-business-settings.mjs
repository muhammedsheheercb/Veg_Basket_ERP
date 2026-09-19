import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS business_settings (
    id integer PRIMARY KEY,
    address text NOT NULL,
    contact_number text NOT NULL,
    email text NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
  );
  INSERT INTO business_settings (id, address, contact_number, email)
  VALUES (1, 'Al Quoz, Dubai, United Arab Emirates', '+971 50 123 4567', 'info@vegbasket.ae')
  ON CONFLICT (id) DO NOTHING;
`);
await client.end();
console.log('Business settings table migration completed.');
