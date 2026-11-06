/** Screenshot whatever the CDP Chrome currently shows. Usage: node tools/shot.mjs <out.png> */
import { writeFileSync } from 'node:fs';
import WebSocket from 'ws';

const out = process.argv[2] ?? 'shot.png';
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

// match the phone viewport so the layout is judged the way players see it
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
const res = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(res.result.data, 'base64'));
console.log('saved', out);
ws.close();
