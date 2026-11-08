/**
 * Join latency probe — times N sequential joins on a throwaway match.
 *
 *   npx tsx scripts/measureJoin.ts [--count 5] [--keep]
 *
 * Creates a fresh match, joins `count` test accounts one after another and
 * prints per-join timings plus the average. Deletes the match afterwards
 * unless --keep is passed. Used to compare the join query count before/after
 * optimising round-trips to a remote database.
 */
import 'dotenv/config';
import pg from 'pg';

const API = process.env.API_BASE_URL ?? 'http://localhost:5000/api/v1';
const TENANT = process.env.TENANT_ID ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '9999900001';
const FIRST_PHONE = 9000000001;

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const COUNT = Number(flag('count', '5'));
const KEEP = argv.includes('--keep');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!.split('?')[0],
  ssl: { rejectUnauthorized: false },
});

async function login(phone: string): Promise<string> {
  const res = await fetch(`${API}/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, phoneNumber: phone, idToken: `dev_otp_${phone}` }),
  });
  const body: any = await res.json();
  if (!body.success) throw new Error(`login failed: ${body.message}`);
  return body.data.token as string;
}

async function main() {
  const adminToken = await login(ADMIN_PHONE);
  const created = await fetch(`${API}/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      gameMode: 'BATTLE_ROYALE',
      matchType: 'SOLO',
      mapType: 'BERMUDA',
      entryFee: 10,
      prizePool: 480,
      matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      totalSlots: 48,
    }),
  }).then((r) => r.json() as Promise<any>);
  if (!created.success) throw new Error(`create failed: ${created.message}`);
  const matchId: string = created.data.id;
  console.log(`probe match: #${created.data.matchNumber} (${matchId})`);

  const timings: number[] = [];
  for (let i = 0; i < COUNT; i += 1) {
    const phone = String(FIRST_PHONE + i);
    const token = await login(phone);
    const started = Date.now();
    const res = await fetch(`${API}/tournaments/${matchId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ inGameName: `TestBot${phone.slice(-3)}`, inGameUid: phone, saveAsDefault: false }),
    });
    const body: any = await res.json();
    const ms = Date.now() - started;
    timings.push(ms);
    console.log(
      `  join ${i + 1}: ${ms}ms  ${body.success ? `seat ${body.data.slotNumber}` : `FAIL ${body.message}`}`,
    );
  }

  const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  const sorted = [...timings].sort((a, b) => a - b);
  console.log(
    `\nsequential joins: n=${timings.length} avg=${avg}ms min=${sorted[0]}ms median=${sorted[Math.floor(sorted.length / 2)]}ms max=${sorted[sorted.length - 1]}ms`,
  );

  if (KEEP) {
    console.log(`kept: ${matchId}`);
    return;
  }
  await pool.query(`delete from "WalletLedger" where "referenceId"=$1`, [matchId]);
  await pool.query(`delete from "TournamentSlot" where "tournamentId"=$1`, [matchId]);
  await pool.query(`delete from "Tournament" where id=$1`, [matchId]);
  await pool.query(`update "User" set "depositBalance"=200 where name like 'TEST BOT%'`);
  console.log('probe match deleted, test balances reset to ₹200');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
