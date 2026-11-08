import 'dotenv/config';
import pg from 'pg';

/**
 * Ops helper: prints every tenant's auth-method flags so you can confirm what the
 * player app will show (Phone OTP / Email OTP / Google) without opening the console.
 *
 * Usage: npx tsx src/scripts/_checkAuthFlags.ts
 */
async function main(): Promise<void> {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query(
      'select id, "brandName", "allowPhoneAuth", "allowGoogleAuth", "allowEmailAuth", "isActive" from "Tenant"',
    );
    console.log(JSON.stringify(r.rows, null, 2));
    console.log(`\nPHONE_OTP_ENABLED (env kill switch) = ${process.env.PHONE_OTP_ENABLED ?? '(unset → true)'}`);
  } finally {
    await pool.end();
  }
}

void main();
