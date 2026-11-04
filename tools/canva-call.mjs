import fs from 'node:fs';

const [, , toolName, argsJson, outDir] = process.argv;
const auth = JSON.parse(fs.readFileSync(`${process.env.USERPROFILE}/.free-pi/agent/mcp-auth.json`, 'utf8'));
const token = Object.values(auth)[0].tokens.access_token;
const URL_ = 'https://api.canva.com/connect/v1/mcp';
const H = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` };
let sid = null, id = 0;

function parseBody(text) {
  const s = text.trim();
  if (s.startsWith('{')) return JSON.parse(s);
  for (const line of s.split(/\r?\n/).filter((l) => l.startsWith('data:')).reverse()) {
    const p = line.slice(5).trim();
    if (p.startsWith('{')) return JSON.parse(p);
  }
  throw new Error('unparseable: ' + s.slice(0, 200));
}
async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { ...H, ...(sid ? { 'mcp-session-id': sid } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  sid = res.headers.get('mcp-session-id') ?? sid;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}: ${text.slice(0, 300)}`);
  return parseBody(text);
}

await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'canva-cli', version: '1' } });
await fetch(URL_, { method: 'POST', headers: { ...H, ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) });

const res = await rpc('tools/call', { name: toolName, arguments: JSON.parse(argsJson || '{}') });
const r = res.result ?? res.error ?? {};
console.log('isError:', Boolean(r.isError ?? res.error));

for (const block of r.content ?? []) {
  if (block.type === 'text') {
    let v = block.text;
    try { v = JSON.stringify(JSON.parse(block.text), null, 1); } catch {}
    console.log(v);
  } else if (block.type === 'image' && outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const file = `${outDir}/canva-${toolName}-${Date.now()}.${(block.mimeType || 'image/png').split('/')[1]}`;
    fs.writeFileSync(file, Buffer.from(block.data, 'base64'));
    console.log('saved image:', file);
  }
}
if (!r.content) console.log(JSON.stringify(r, null, 1).slice(0, 1500));