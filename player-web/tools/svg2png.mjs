/**
 * Rasterise an SVG to PNG with headless Chrome (CDP).
 * Usage: node tools/svg2png.mjs <in.svg> <out.png> [px]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import WebSocket from 'ws';

const [, , input, output, sizeArg] = process.argv;
const px = Number(sizeArg ?? 256);
const svg = readFileSync(resolve(input), 'utf8').replace(/<\?xml[^>]*>/, '');

const targets = await (await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(targets.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((r) => ws.once('open', r));
let id = 0;
const pending = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString());
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((r) => pending.set(i, r));
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Page.navigate', { url: 'data:text/html,' + encodeURIComponent(
  `<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`,
)});
await new Promise((r) => setTimeout(r, 700));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(resolve(output), Buffer.from(shot.result.data, 'base64'));
console.log('wrote', output, px + 'px');
ws.close();
await fetch('http://127.0.0.1:9222/json/close/' + targets.id).catch(() => {});
