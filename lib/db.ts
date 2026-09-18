import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool(connectionString ? { connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } } : {});
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;
export const db = drizzle(pool, { schema });
