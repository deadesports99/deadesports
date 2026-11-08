/**
 * Checks the web lobby refresh button picks up a match that was inserted
 * straight into Postgres (no API, no realtime event).
 *
 *   node tools/webcheck-refresh.mjs <matchNumber>
 *
 * Needs Chrome on :9222 and vite on :5173.
 */
import WebSocket from 'ws';

const API = 'http://localhost:5000/api/v1';
const TENANT = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const BOT = '9000000049';
const TARGET = process.argv[2] ?? '';
/** `--refresh-only` skips login+navigate and just presses the chip on the open page. */
const REFRESH_ONLY = process.argv.includes('--refresh-only');
const APP = 'http://127.0.0.1:5173';

const json = async (url, init) => (await fetch(url, init)).json();

const login = await json(`${API}/auth/player/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tenantId: TENANT, phoneNumber: BOT, idToken: `dev_otp_${BOT}` }),
});
const session = login.data;

const targets = await json('http://127.0.0.1:9222/json');
const page = targets.find((t) => t.type === 'page' && t.url.includes('5173'));
if (!page) throw new Error('no page target for the web app on :9222');

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 32 * 1024 * 1024 });
await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
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
if (!REFRESH_ONLY) {
await evaluate(`(() => {
  localStorage.setItem('thunder.auth.token', ${JSON.stringify(session.token)});
  localStorage.setItem('thunder.auth.user', ${JSON.stringify(JSON.stringify(session.user))});
  return 'ok';
})()`);
await send('Page.navigate', { url: APP });
await new Promise((r) => setTimeout(r, 6000));
}

const before = await evaluate('document.body.innerText');
const seenBefore = new RegExp(`\\b${TARGET}\\b`).test(before);
console.log(`#${TARGET} before refresh: ${seenBefore ? 'YES' : 'NO'}`);
console.log(`header: ${(before.match(/MATCHES \(\d+\)/) ?? ['(none)'])[0]}`);

// Click the refresh chip exactly like a player would.
await evaluate(`(() => {
  const chip = [...document.querySelectorAll('button,[role=button],div')]
    .find((el) => /Refresh/i.test(el.textContent || '') && (el.textContent || '').length < 40);
  if (!chip) return 'no-chip';
  chip.click();
  return 'clicked';
})()`);
await new Promise((r) => setTimeout(r, 4000));

const after = await evaluate('document.body.innerText');
const seenAfter = new RegExp(`\\b${TARGET}\\b`).test(after);
console.log(`#${TARGET} after refresh click: ${seenAfter ? 'YES' : 'NO'}`);
console.log(`header: ${(after.match(/MATCHES \(\d+\)/) ?? ['(none)'])[0]}`);

ws.close();
if (!seenAfter) process.exitCode = 1;
