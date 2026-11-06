/**
 * Wallet smoke test: reads the real balances + ledger, then runs a mock ₹50
 * deposit through the gateway and prints the new balance.
 * Usage: node tools/webcheck-wallet.mjs [amount]
 */
import WebSocket from 'ws';

const amount = Number(process.argv[2] ?? 50);
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('5173'));
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
const clickText = (re) => `(() => {
  const b = [...document.querySelectorAll('button')].find((x) => ${re}.test(x.innerText));
  if (!b) return 'missing';
  b.click();
  return 'clicked';
})()`;

await send('Runtime.enable');
await ev(`location.href = 'http://127.0.0.1:5173/'`);
await sleep(2500);

console.log('--- open wallet tab ---');
console.log(await ev(clickText('/wallet/i')));
await sleep(1500);

const before = await ev(`(() => {
  const text = document.body.innerText;
  return JSON.stringify({
    balances: text.split(String.fromCharCode(10)).filter((l) => /^₹/.test(l.trim())).slice(0, 6),
    ledgerRows: text.split(String.fromCharCode(10)).filter((l) => /Entry Fee|Added Cash|Prize|Withdrawal|Refund/i.test(l)).slice(0, 5),
  });
})()`);
console.log('before:', before);

console.log('--- add cash ---');
console.log(await ev(clickText('/^add cash$/i')));
await sleep(800);
console.log(await ev(`(() => {
  const input = document.querySelector('input[inputmode="numeric"], input[type="number"], input#add-amount');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  if (!input) return 'no-amount-input';
  setter.call(input, '${amount}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'amount-set';
})()`));
await sleep(400);
console.log(await ev(clickText('/^pay ₹/i')));
await sleep(9000);

const after = await ev(`(() => {
  const text = document.body.innerText;
  return JSON.stringify({
    balances: text.split(String.fromCharCode(10)).filter((l) => /^₹/.test(l.trim())).slice(0, 6),
    top: text.split(String.fromCharCode(10)).slice(0, 6),
  });
})()`);
console.log('after:', after);
ws.close();
