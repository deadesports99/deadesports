/**
 * Last-seat race test — "45 joined, 3 seats left, fire everything at once".
 *
 *   npx tsx scripts/raceJoinTest.ts                 # create match + fill 45 + race 55
 *   npx tsx scripts/raceJoinTest.ts --fill 45 --race 55 --slots 48
 *   npx tsx scripts/raceJoinTest.ts --cleanup <matchId>
 *
 * The point is to prove (or break) the join transaction under real concurrency:
 * exactly `slotsLeft` players must get a seat, everyone else must get a clean
 * 4xx (never a 500), no seat may be sold twice, no wallet may go negative and
 * the JOIN_FEE ledger must have one row per successful join.
 */
import 'dotenv/config';
import pg from 'pg';

const API = process.env.API_BASE_URL ?? 'http://localhost:5000/api/v1';
const TENANT = process.env.TENANT_ID ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? '9999900001';
const FIRST_PHONE = 9000000001;
const TOTAL_ACCOUNTS = 100;

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const FILL = Number(flag('fill', '45'));
const RACE = Number(flag('race', '55'));
const ENTRY_FEE = Number(flag('fee', '10'));
const TOTAL_SLOTS = Number(flag('slots', '48'));
/** Extra duplicate taps per account — simulates a user hammering the button. */
const DUP = Math.max(1, Number(flag('dup', '1')));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL!.split('?')[0],
  ssl: { rejectUnauthorized: false },
});

type LoginResult = { phone: string; token: string };

async function login(phone: string): Promise<LoginResult> {
  const res = await fetch(`${API}/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, phoneNumber: phone, idToken: `dev_otp_${phone}` }),
  });
  const body: any = await res.json();
  if (!body.success) throw new Error(`login ${phone} failed: ${body.message}`);
  return { phone, token: body.data.token };
}

async function createMatch(adminToken: string) {
  const matchTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${API}/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      gameMode: 'BATTLE_ROYALE',
      matchType: 'SOLO',
      mapType: 'BERMUDA',
      entryFee: ENTRY_FEE,
      prizePool: ENTRY_FEE * TOTAL_SLOTS,
      matchTime,
      totalSlots: TOTAL_SLOTS,
    }),
  });
  const body: any = await res.json();
  if (!body.success) throw new Error(`create match failed: ${body.message}`);
  return body.data as { id: string; matchNumber: number; title: string };
}

interface JoinOutcome {
  phone: string;
  status: number;
  ok: boolean;
  message: string;
  seat?: number;
  ms: number;
}

async function join(account: LoginResult, tournamentId: string): Promise<JoinOutcome> {
  const started = Date.now();
  try {
    const res = await fetch(`${API}/tournaments/${tournamentId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
      body: JSON.stringify({
        inGameName: `TestBot${account.phone.slice(-3)}`,
        inGameUid: account.phone,
        saveAsDefault: false,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    return {
      phone: account.phone,
      status: res.status,
      ok: res.ok && body?.success === true,
      message: `${body?.message ?? `HTTP ${res.status}`}${
        body?.details ? ` [${JSON.stringify(body.details)}]` : ''
      }`,
      seat: body?.data?.slotNumber,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      phone: account.phone,
      status: 0,
      ok: false,
      message: `network: ${(error as Error).message}`,
      ms: Date.now() - started,
    };
  }
}

async function dbFacts(tournamentId: string) {
  const match = await pool.query(
    `select "totalSlots", status from "Tournament" where id=$1`,
    [tournamentId],
  );
  const seats = await pool.query(
    `select count(*)::int as rows, count(distinct "slotNumber")::int as "distinctSeats", min("slotNumber") as lo, max("slotNumber") as hi
       from "TournamentSlot" where "tournamentId"=$1`,
    [tournamentId],
  );
  const ledger = await pool.query(
    `select count(*)::int as n, coalesce(sum(amount),0)::text as total
       from "WalletLedger" where "referenceId"=$1 and category='JOIN_FEE'`,
    [tournamentId],
  );
  const negative = await pool.query(
    `select count(*)::int as n from "User" where "depositBalance" < 0`,
  );
  return {
    totalSlots: match.rows[0]?.totalSlots,
    status: match.rows[0]?.status,
    slotRows: seats.rows[0].rows,
    distinctSeats: seats.rows[0].distinctSeats,
    seatRange: `${seats.rows[0].lo}..${seats.rows[0].hi}`,
    joinFeeRows: ledger.rows[0].n,
    joinFeeTotal: ledger.rows[0].total,
    usersWithNegativeBalance: negative.rows[0].n,
  };
}

function histogram(outcomes: JoinOutcome[]) {
  const counts = new Map<string, number>();
  for (const o of outcomes) {
    const key = `${o.status} ${o.message}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const cleanupId = flag('cleanup');
  if (cleanupId) return cleanup(cleanupId);

  const existing = flag('match');
  const admin = existing ? null : await login(ADMIN_PHONE);
  const match = existing
    ? { id: existing, matchNumber: Number(flag('number', '0')), title: 'existing match' }
    : await createMatch(admin!.token);
  console.log(`\nMATCH #${match.matchNumber} "${match.title}"  id=${match.id}  slots=${TOTAL_SLOTS} fee=₹${ENTRY_FEE}\n`);

  console.log(`logging in ${TOTAL_ACCOUNTS} test accounts…`);
  const accounts: LoginResult[] = [];
  for (let i = 0; i < TOTAL_ACCOUNTS; i += 1) accounts.push(await login(String(FIRST_PHONE + i)));
  console.log(`logged in: ${accounts.length}`);

  // ── Phase 1: fill seats one by one (expected: all succeed) ──────────────
  console.log(`\nphase 1 — joining ${FILL} players sequentially…`);
  const fillOutcomes: JoinOutcome[] = [];
  for (const account of accounts.slice(0, FILL)) fillOutcomes.push(await join(account, match.id));
  const fillFails = fillOutcomes.filter((o) => !o.ok);
  console.log(`seats taken: ${fillOutcomes.length - fillFails.length}/${FILL} fails=${fillFails.length}`);
  for (const [key, n] of histogram(fillFails)) console.log(`   fail ${n}× ${key}`);

  const before = await dbFacts(match.id);
  const seatsLeft = before.totalSlots - before.slotRows;
  console.log(`DB after fill: slots=${before.slotRows}/${before.totalSlots} seatsLeft=${seatsLeft}`);

  // ── Phase 2: everybody else hammers the last seats at the same instant ──
  const racers = accounts.slice(FILL, FILL + RACE);
  // Duplicate taps: the same player can fire several requests at once from a
  // laggy phone. The extras must get a clean 409, never a 500.
  const burst = racers.flatMap((account) => Array.from({ length: DUP }, () => account));
  console.log(`\nphase 2 — RACE: ${burst.length} concurrent joins (${racers.length} players × ${DUP} taps) for ${seatsLeft} seat(s)…`);
  const raceStart = Date.now();
  const raceOutcomes = await Promise.all(burst.map((a) => join(a, match.id)));
  const wallMs = Date.now() - raceStart;

  const winners = raceOutcomes.filter((o) => o.ok);
  const losers = raceOutcomes.filter((o) => !o.ok);
  const serverErrors = raceOutcomes.filter((o) => o.status >= 500 || o.status === 0);
  const latencies = raceOutcomes.map((o) => o.ms).sort((a, b) => a - b);

  console.log(`wall time: ${wallMs}ms   p50 ${latencies[Math.floor(latencies.length / 2)]}ms   max ${latencies[latencies.length - 1]}ms`);
  console.log(`winners: ${winners.length}  expected: ${seatsLeft}`);
  console.log(`seat numbers won: ${winners.map((w) => w.seat).sort((a, b) => (a ?? 0) - (b ?? 0)).join(', ')}`);
  console.log(`losers: ${losers.length}   5xx/network: ${serverErrors.length}`);
  console.log('\nloser breakdown:');
  for (const [key, n] of histogram(losers)) console.log(`   ${n}× ${key}`);

  const after = await dbFacts(match.id);
  console.log('\nDB after race:');
  console.log(JSON.stringify(after, null, 1));

  const checks: Array<[string, boolean, string]> = [
    ['no server crash / 5xx', serverErrors.length === 0, `${serverErrors.length} requests returned 5xx or network error`],
    ['no oversell', after.slotRows <= after.totalSlots!, `${after.slotRows} slot rows for ${after.totalSlots} seats`],
    ['match full', after.slotRows === after.totalSlots!, `${after.slotRows}/${after.totalSlots}`],
    ['winners == seats that were free', winners.length === seatsLeft, `${winners.length} winners vs ${seatsLeft} free seats`],
    ['no duplicate seat numbers', after.distinctSeats === after.slotRows, `${after.distinctSeats} distinct of ${after.slotRows} rows`],
    ['one JOIN_FEE ledger row per seat', after.joinFeeRows === after.slotRows, `${after.joinFeeRows} rows vs ${after.slotRows} seats`],
    ['fee total matches seats × fee', Number(after.joinFeeTotal) === after.slotRows * ENTRY_FEE, `₹${after.joinFeeTotal} vs ₹${after.slotRows * ENTRY_FEE}`],
    ['no negative wallet', after.usersWithNegativeBalance === 0, `${after.usersWithNegativeBalance} users below zero`],
  ];

  console.log('\nresult:');
  let failed = 0;
  for (const [name, passed, detail] of checks) {
    if (!passed) failed += 1;
    console.log(`  ${passed ? 'OK  ' : 'FAIL'}  ${name}${passed ? '' : ` — ${detail}`}`);
  }
  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
  console.log(`\nmatch kept for the app: #${match.matchNumber} (id ${match.id})`);
  console.log(`cleanup: npx tsx scripts/raceJoinTest.ts --cleanup ${match.id}`);
  return failed === 0 ? 0 : 1;
}

async function cleanup(tournamentId: string) {
  const phones = await pool.query(
    `select distinct u."phoneNumber" from "TournamentSlot" ts join "User" u on u.id=ts."userId" where ts."tournamentId"=$1`,
    [tournamentId],
  );
  const ledger = await pool.query(`delete from "WalletLedger" where "referenceId"=$1`, [tournamentId]);
  const slots = await pool.query(`delete from "TournamentSlot" where "tournamentId"=$1`, [tournamentId]);
  await pool.query(`delete from "MatchResult" where "tournamentId"=$1`, [tournamentId]).catch(() => undefined);
  const match = await pool.query(`delete from "Tournament" where id=$1`, [tournamentId]);
  const refund = await pool.query(
    `update "User" set "depositBalance"=200 where name like 'TEST BOT%'`,
  );
  console.log(
    `cleaned: ledger=${ledger.rowCount} slots=${slots.rowCount} match=${match.rowCount} ` +
      `players=${phones.rows.length} test balances reset=${refund.rowCount}`,
  );
}

main()
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
