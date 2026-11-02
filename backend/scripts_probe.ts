import 'dotenv/config';
import pg from 'pg';

async function main() {
  const url = process.env.DATABASE_URL!;
  const variants: Array<[string, any]> = [
    ['pool ssl false-verify (string url)', { connectionString: url, ssl: { rejectUnauthorized: false } }],
    ['strip sslmode + ssl false-verify', { connectionString: url.replace(/\?.*$/, ''), ssl: { rejectUnauthorized: false } }],
    ['strip sslmode + ssl true', { connectionString: url.replace(/\?.*$/, ''), ssl: true }],
  ];
  for (const [name, cfg] of variants) {
    const pool = new pg.Pool(cfg);
    try {
      const res = await pool.query('select count(*)::int as n from "Tenant"');
      console.log('OK  ', name, '=> tenants:', res.rows[0].n);
    } catch (e) {
      console.log('FAIL', name, '=>', (e as Error).message.slice(0, 90));
    } finally {
      await pool.end();
    }
  }
}
void main();
