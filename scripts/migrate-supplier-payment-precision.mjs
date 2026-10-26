import pg from 'pg';

const { DATABASE_URL }=process.env;
if(!DATABASE_URL)throw new Error('DATABASE_URL is required.');
const client=new pg.Client({connectionString:DATABASE_URL,ssl:DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});
await client.connect();
try{
  await client.query(`ALTER TABLE supplier_payments ALTER COLUMN amount TYPE numeric(14,3)`);
  console.log('Supplier payments now support three decimal places.');
}finally{await client.end();}
