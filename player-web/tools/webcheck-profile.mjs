/**
 * Profile tab check: opens the tab, prints the identity + career numbers, edits
 * the Free Fire IGN and verifies the save round-trips through the API.
 */
import WebSocket from 'ws';

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

await send('Runtime.enable');
await ev(`location.href = 'http://127.0.0.1:5173/'`);
await sleep(2600);

const click = (re) => ev(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => ${re}.test(x.innerText));
  if (!b) return 'missing';
  b.click();
  return 'clicked';
})()`);

console.log('open profile :', await click('/^profile$/i'));
await sleep(1600);
const lines = String(await ev('document.body.innerText')).split(String.fromCharCode(10));
console.log('identity     :', lines.filter((l) => /Player ID|•/i.test(l)).slice(0, 2).join(' | '));
console.log('career       :', lines.slice(lines.findIndex((l) => /Matches/i.test(l)) - 1, lines.findIndex((l) => /Matches/i.test(l)) + 8).join(' '));
console.log('ign/uid      :', lines.filter((l) => /SpartanOP|UID|digit/i.test(l)).slice(0, 3).join(' | '));

// 1) duplicate UID must be refused by the API (uid belongs to another player)
const dup = '123456789';
await ev(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[1], '${dup}');
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await sleep(300);
console.log('dup save     :', await click('/save free fire details/i'));
await sleep(1800);
const dupLines = String(await ev('document.body.innerText')).split(String.fromCharCode(10));
console.log('dup error    :', dupLines.find((l) => /already registered/i.test(l)) ?? 'no error shown');

// 2) a fresh UID + IGN must save
const freshUid = String(900000000 + Math.floor(Math.random() * 99999999));
await ev(`(() => {
  const inputs = [...document.querySelectorAll('input')];
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[0], 'ProfileEdit${Math.floor(Math.random() * 90) + 10}');
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  setter.call(inputs[1], '${freshUid}');
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await sleep(400);
console.log('save click   :', await click('/save free fire details/i'));
await sleep(2200);
const after = String(await ev('document.body.innerText')).split(String.fromCharCode(10));
console.log('saved state  :', after.filter((l) => /Saved|saved/i.test(l)).slice(0, 2).join(' | ') || 'no marker');
console.log('api echo     :', await ev(`(async () => {
  const r = await fetch('http://localhost:5000/api/v1/players/me/stats', { headers: { Authorization: 'Bearer ' + localStorage.getItem('thunder.auth.token') } });
  const me = await (await fetch('http://localhost:5000/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('thunder.auth.token') } })).json();
  return 'stats=' + r.status + ' ign=' + (me?.data?.inGameName ?? '?') + ' uid=' + (me?.data?.inGameUid ?? '?');
})()`));
ws.close();
