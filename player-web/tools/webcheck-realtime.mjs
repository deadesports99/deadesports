/**
 * Proves the web lobby updates itself: logs in as a test bot over CDP, reads the
 * visible match numbers, creates a match through the API, then checks the number
 * appears on screen WITHOUT anyone clicking the refresh chip.
 *
 * Needs Chrome with --remote-debugging-port=9222 and vite on :5173.
 *   node tools/webcheck-realtime.mjs
 */
import WebSocket from 'ws';

const API = 'http://localhost:5000/api/v1';
const TENANT = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const ADMIN = '9999900001';
const BOT = '9000000049';
const APP = 'http://127.0.0.1:5173';

const json = async (url, init) => (await fetch(url, init)).json();

/** Log in over the API so the browser can be handed a ready-made session. */
async function session(phone) {
  const res = await json(`${API}/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, phoneNumber: phone, idToken: `dev_otp_${phone}` }),
  });
  if (!res.success) throw new Error(`login failed for ${phone}: ${res.message}`);
  return res.data;
}

const targets = await json('http://127.0.0.1:9222/json');
const page = targets.find((t) => t.type === 'page' && t.url.includes('5173'));
if (!page) throw new Error('no page target for the web app on :9222');

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', reject);
});
let seq = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text ?? 'evaluate failed');
  return out.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

// Hand the browser the bot session, then reload so the app boots signed in.
const bot = await session(BOT);
const user = bot.user;
await evaluate(`(() => {
  localStorage.setItem('thunder.auth.token', ${JSON.stringify(bot.token)});
  localStorage.setItem('thunder.auth.user', ${JSON.stringify(JSON.stringify(user))});
  return 'ok';
})()`);
await send('Page.navigate', { url: APP });
await new Promise((r) => setTimeout(r, 6000));

const before = await evaluate('document.body.innerText');
const beforeNumbers = [...before.matchAll(/\b8\d\d\b/g)].map((m) => m[0]).slice(0, 12);
console.log(`signed in as ${user.phoneNumber ?? user.id}`);
console.log(`match numbers on screen before: ${[...new Set(beforeNumbers)].join(', ') || '(none)'}`);

// Create a match the way an admin would.
const admin = await session(ADMIN);
const created = await json(`${API}/tournaments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
  body: JSON.stringify({
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'NEXTERRA',
    entryFee: 10,
    prizePool: 480,
    matchTime: new Date(Date.now() + 8 * 3600_000).toISOString(),
    totalSlots: 48,
    visibilityHours: null,
  }),
});
if (!created.success) throw new Error(`create failed: ${created.message}`);
const number = String(created.data.matchNumber);
console.log(`created match #${number} (${created.data.id}) — not touching the page`);

await new Promise((r) => setTimeout(r, 6000));
const after = await evaluate('document.body.innerText');
const appeared = new RegExp(`\\b${number}\\b`).test(after);
console.log(`#${number} on screen after 6s without a refresh click: ${appeared ? 'YES' : 'NO'}`);
console.log('----- visible text -----');
console.log(after.split('\n').filter((l) => l.trim()).slice(0, 25).join('\n'));

ws.close();
if (!appeared) process.exitCode = 1;
