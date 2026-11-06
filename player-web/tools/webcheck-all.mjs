/**
 * Full local pass: walks every screen once against the running API and prints
 * what it sees, so "it works" is always backed by real output.
 * Usage: node tools/webcheck-all.mjs
 */
import WebSocket from 'ws';

const BASE = 'http://127.0.0.1:5173';
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('5173'));
if (!page) throw new Error('start Chrome with --remote-debugging-port=9222');

const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((r) => ws.once('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pending.set(i, r)); };
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'eval failed');
  return r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => ev('document.body.innerText');
const lines = async (re, take = 6) =>
  String(await text()).split(String.fromCharCode(10)).filter((l) => re.test(l)).slice(0, take);
const click = (re) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => ${re}.test(x.innerText));
  if (!b) return 'missing';
  b.click();
  return 'clicked';
})()`);

await send('Runtime.enable');
await ev(`location.href = '${BASE}'`);
await sleep(2500);

/** Fresh profiles land on Sign In; walk the dev OTP login once. */
async function ensureLoggedIn() {
  const onLogin = await ev(`/Sign In/i.test(document.body.innerText)`);
  if (!onLogin) return 'session reused';
  await ev(`(() => {
    const input = document.querySelector('#phone-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '9876500011');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const b = [...document.querySelectorAll('button')].find((x) => /continue with phone/i.test(x.innerText));
    b.click();
    return 'ok';
  })()`);
  await sleep(1200);
  await ev(`(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    document.querySelectorAll('input[id^="otp-"]').forEach((box, i) => {
      setter.call(box, '482916'[i]);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const b = [...document.querySelectorAll('button')].find((x) => /verify otp/i.test(x.innerText));
    b.click();
    return 'ok';
  })()`);
  await sleep(3200);
  return 'logged in';
}

console.log('0. auth           :', await ensureLoggedIn());

// Wait for the lobby request to land (prevents sampling the initial empty state).
for (let attempt = 0; attempt < 12; attempt += 1) {
  if (/UPCOMING MATCHES \([1-9]/i.test(String(await text()))) break;
  await sleep(700);
}

console.log('1. lobby          :', (await lines(/MATCHES \(/i, 1))[0] ?? 'MISSING');
console.log('   balance        :', (await lines(/^₹/, 1))[0] ?? 'MISSING');

console.log('2. wallet         :', await click(/wallet/i));
await sleep(1500);
console.log('   balances       :', (await lines(/^₹/, 4)).join(' '));
console.log('   passbook rows  :', (await lines(/RECORDS?$/i, 1))[0] ?? 'none');

// receipt modal for the newest ledger row
await ev(`(() => {
  // Ledger rows are plain divs with an onClick, so pick the leaf that has the text.
  const row = [...document.querySelectorAll('div.cursor-pointer')].find((el) => /Entry fee|Added Cash/i.test(el.innerText));
  if (row) row.click();
  return row ? 'ok' : 'no-row';
})()`);
await sleep(900);
console.log('3. receipt modal  :', (await lines(/Reference|Closing Balance|UTR|Transaction/i, 3)).join(' | ') || 'not opened');
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /close|✕|×/i.test(x.innerText + (x.getAttribute('aria-label') || ''))); if (b) b.click(); return 'ok'; })()`);
await sleep(500);

// withdraw guard: winnings are usually 0 -> the server/modal must refuse
console.log('4. withdraw       :', await click(/^withdraw$/i));
await sleep(700);
await ev(`(() => {
  const input = [...document.querySelectorAll('input')].find((i) => /amount/i.test(i.placeholder || '') || i.id === 'modal-withdraw-amount');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  if (input) { setter.call(input, '50'); input.dispatchEvent(new Event('input', { bubbles: true })); }
  return input ? 'typed' : 'no-input';
})()`);
await sleep(300);
const cta = [...String(await text()).split(String.fromCharCode(10))].find((l) => /Transfer ₹/i.test(l)) ?? 'no-cta';
console.log('   cta            :', cta);
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Transfer ₹/i.test(x.innerText)); return b ? 'disabled=' + b.disabled : 'missing'; })()`).then((v) => console.log('   eligibility    :', v));
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /cancel|close|✕/i.test(x.innerText + (x.getAttribute('aria-label') || ''))); if (b) b.click(); return 'ok'; })()`);

console.log('5. settings       :', await click(/settings/i));
await sleep(1200);
console.log('   account        :', (await lines(/• \+91/))[0] ?? 'MISSING');

console.log('6. back to lobby  :', await click(/tournaments/i));
await sleep(1000);
console.log('   lobby          :', (await lines(/MATCHES \(/i, 1))[0] ?? 'MISSING');

ws.close();
