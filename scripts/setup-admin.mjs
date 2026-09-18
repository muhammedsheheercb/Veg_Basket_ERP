import bcrypt from 'bcryptjs';
import pg from 'pg';

const { DATABASE_URL, ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD) throw new Error('DATABASE_URL, ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD are required.');

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false } });
await client.connect();
await client.query(`CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL, name text NOT NULL, role text NOT NULL DEFAULT 'staff',
  active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, mobile text NOT NULL,
  address text, opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id), purchase_date date NOT NULL,
  description text, total numeric(14,2) NOT NULL CHECK(total >= 0),
  paid numeric(14,2) NOT NULL DEFAULT 0 CHECK(paid >= 0 AND paid <= total),
  payment_method text, notes text, created_at timestamp NOT NULL DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id uuid NOT NULL REFERENCES suppliers(id),
  purchase_id uuid NOT NULL REFERENCES purchases(id), payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK(amount > 0), method text NOT NULL, notes text,
  idempotency_key text UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
)`);
await client.query(`CREATE TABLE IF NOT EXISTS mutation_requests (idempotency_key text PRIMARY KEY, created_at timestamp NOT NULL DEFAULT now())`);
await client.query(`ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS idempotency_key text`);
await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS supplier_payments_idempotency_key_unique ON supplier_payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);
await client.query(`CREATE TABLE IF NOT EXISTS sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text NOT NULL UNIQUE, customer_name text NOT NULL, sale_date date NOT NULL, total numeric(14,2) NOT NULL, paid numeric(14,2) NOT NULL DEFAULT 0)`);
await client.query(`CREATE TABLE IF NOT EXISTS expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category text NOT NULL, expense_date date NOT NULL, amount numeric(14,2) NOT NULL, notes text)`);
await client.query(`CREATE TABLE IF NOT EXISTS loans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lender text NOT NULL, outstanding numeric(14,2) NOT NULL, next_emi_date date, next_emi_amount numeric(14,2))`);
const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);
await client.query(`INSERT INTO users (email, password_hash, name, role)
  VALUES ($1, $2, 'Veg Basket Administrator', 'admin')
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, active = true`, [ADMIN_EMAIL.toLowerCase(), passwordHash]);
await client.end();
console.log(`Administrator account is ready for ${ADMIN_EMAIL.toLowerCase()}.`);
