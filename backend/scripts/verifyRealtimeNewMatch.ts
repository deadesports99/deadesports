/**
 * Proves the realtime fix: a WS client connected like the player app must
 * receive MATCH_CREATED within a second of an admin creating a match, and the
 * match must then be present in GET /tournaments without any manual refresh.
 *
 *   npx tsx scripts/verifyRealtimeNewMatch.ts            # create → assert → clean up
 *   npx tsx scripts/verifyRealtimeNewMatch.ts --keep     # leave the match in place
 */
import 'dotenv/config';
import WebSocket from 'ws';

const API = process.env.API_BASE_URL ?? 'http://localhost:5000/api/v1';
const TENANT = process.env.TENANT_ID ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const ADMIN = process.env.ADMIN_PHONE ?? '9999900001';
const KEEP = process.argv.includes('--keep');

const wsUrl = `${API.replace(/^http/, 'ws').replace(/\/api\/v1$/, '')}/ws?tenantId=${TENANT}`;

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, phoneNumber: ADMIN, idToken: `dev_otp_${ADMIN}` }),
  }).then((r) => r.json() as Promise<any>);
  if (!res.success) throw new Error(`login failed: ${res.message}`);
  return res.data.token as string;
}

async function main() {
  const token = await login();
  const seen: Array<{ type: string; data: any }> = [];

  const ws = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      seen.push(msg);
    } catch {
      /* ignore */
    }
  });
  console.log(`ws connected: ${wsUrl}`);

  const created = await fetch(`${API}/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      gameMode: 'BATTLE_ROYALE',
      matchType: 'SOLO',
      mapType: 'BERMUDA',
      entryFee: 10,
      prizePool: 480,
      matchTime: new Date(Date.now() + 5 * 3600_000).toISOString(),
      totalSlots: 48,
      visibilityHours: null,
    }),
  }).then((r) => r.json() as Promise<any>);
  if (!created.success) throw new Error(`create failed: ${created.message}`);
  const id: string = created.data.id;

  await new Promise((r) => setTimeout(r, 1200));
  const event = seen.find((m) => m.type === 'MATCH_CREATED' && m.data?.tournamentId === id);
  const feed = await fetch(`${API}/tournaments?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json() as Promise<any>);
  const inFeed = (feed.data.items as any[]).some((t) => t.id === id);

  console.log(`match #${created.data.matchNumber} (${id}) created`);
  console.log(`ws frames received: ${seen.map((m) => m.type).join(', ') || '(none)'}`);
  console.log(`MATCH_CREATED for this match: ${event ? 'YES' : 'NO'} ${event ? JSON.stringify(event.data) : ''}`);
  console.log(`present in GET /tournaments without refresh: ${inFeed ? 'YES' : 'NO'}`);

  ws.close();

  if (!KEEP) {
    const del = await fetch(`${API}/tournaments/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: 'realtime verification cleanup' }),
    }).then((r) => r.json() as Promise<any>);
    console.log(`cleanup: ${del.success ? 'match cancelled' : `FAILED ${del.message}`}`);
  } else {
    console.log(`kept: ${id}`);
  }

  if (!event || !inFeed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
