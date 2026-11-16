#!/usr/bin/env node
/**
 * Phone Dev Console — "fatak fatak" Android test loop.
 *
 * Kya karta hai:
 *   - Mobile-friendly web panel (phone ke browser me khulta hai, adb reverse ke zariye)
 *   - Ek tap me: build + install + app launch (player/admin)
 *   - Auto-build watcher: laptop par file save karo -> APK khud install
 *   - Live logcat, live build log, phone ka screenshot panel me
 *   - adb reverse (tcp:5000 backend) apne aap
 *
 * Chalane ka tarika (repo root se):
 *   node scripts/dev-console.mjs            -> http://localhost:5199
 *   START-DEV-CONSOLE.bat                   -> same, browser bhi khol deta hai
 *
 * Zero dependencies. Node 18+.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ANDROID = path.join(ROOT, 'android');
const PORT = Number(process.env.DEV_CONSOLE_PORT || 5199);
const WATCH_DEBOUNCE_MS = Number(process.env.DEV_CONSOLE_DEBOUNCE || 1200);

// ---------------------------------------------------------------- adb finding
function findAdb() {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const candidates = [
    process.env.ADB,
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', exe),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', exe),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', exe),
    process.env.HOME && path.join(process.env.HOME, 'Android', 'Sdk', 'platform-tools', exe),
  ].filter(Boolean);
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
  }
  return exe; // PATH se utha lo
}

const ADB = findAdb();

// -------------------------------------------------------------- app definitions
const APPS = {
  player: {
    key: 'player',
    label: 'Player App',
    module: ':app-player',
    cfg: 'android/app-player/src/main/assets/client_config.json',
    watch: ['android/app-player/src', 'android/core/src'],
    defaultPkg: 'com.thunderesports.player',
  },
  admin: {
    key: 'admin',
    label: 'Admin App',
    module: ':app-admin',
    cfg: 'android/app-admin/src/main/assets/client_config.json',
    watch: ['android/app-admin/src', 'android/core/src'],
    defaultPkg: 'com.thunderesports.admin',
  },
};

function appPkg(app) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, app.cfg), 'utf8'));
    return cfg.application_id || app.defaultPkg;
  } catch {
    return app.defaultPkg;
  }
}

// ------------------------------------------------------------------ tiny state
const state = {
  settings: { autoTarget: 'player', autoLaunch: true, autoReverse: true },
  build: { running: false, app: null, ok: null, startedAt: null, finishedAt: null, secs: null, mode: null },
  watcher: { on: false, timer: null, hits: 0, lastFile: null },
  logcat: { proc: null, lines: [], subs: 0 },
  buildLog: [],
  sse: new Set(),
  queue: [],
  lastError: null,
};

const MAX_LINES = 600;
function pushRing(arr, line) {
  arr.push(line);
  if (arr.length > MAX_LINES) arr.splice(0, arr.length - MAX_LINES);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of state.sse) {
    try { res.write(payload); } catch { state.sse.delete(res); }
  }
}

// --------------------------------------------------------------- process utils
function run(cmd, args, { cwd = ROOT, onLine, timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    // Windows par .bat/.cmd ko cmd.exe ke through chalana padta hai.
    const viaCmd = process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd);
    const child = viaCmd
      ? spawn('cmd.exe', ['/d', '/s', '/c', cmd, ...args], { cwd, windowsHide: true })
      : spawn(cmd, args, { cwd, windowsHide: true });

    let out = '';
    const handle = (chunk) => {
      const text = chunk.toString();
      out += text;
      if (onLine) for (const line of text.split(/\r?\n/)) if (line.trim()) onLine(line.trim());
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    let timer = null;
    if (timeoutMs > 0) timer = setTimeout(() => { try { child.kill(); } catch {} }, timeoutMs);
    child.on('error', (err) => { if (timer) clearTimeout(timer); resolve({ code: -1, out: `${out}\n${err.message}` }); });
    child.on('close', (code) => { if (timer) clearTimeout(timer); resolve({ code: code ?? -1, out }); });
  });
}

const adb = (args, opts) => run(ADB, args, { timeoutMs: 20000, ...opts });
const adbShell = (cmd, opts) => adb(['shell', ...cmd.split(' ')], opts);

async function adbDevices() {
  const { out } = await adb(['devices']);
  return out
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [serial, ...rest] = l.split(/\s+/);
      return { serial, status: rest.join(' ') || 'unknown' };
    });
}

async function ensureReverse() {
  const ports = [5000, PORT]; // backend + ye console
  const results = [];
  for (const p of ports) {
    const { code } = await adb(['reverse', `tcp:${p}`, `tcp:${p}`]);
    results.push({ port: p, ok: code === 0 });
  }
  return results;
}

// --------------------------------------------------------------------- gradle
function gradlewArgs(app = null) {
  const args = ['--daemon', '--build-cache', '--parallel', '-Dorg.gradle.console=plain', '--console=plain'];
  // Local backend par test karna ho: DEV_CONSOLE_API_BASE=http://localhost:5000/api/v1
  const apiBase = (process.env.DEV_CONSOLE_API_BASE || '').trim();
  if (apiBase && /^https?:\/\/[^\s]+\/api\/v1$/.test(apiBase)) args.push(`-PapiBaseUrl=${apiBase}`);
  return args;
}

async function buildApp(appKey, mode = 'install') {
  const app = APPS[appKey];
  if (!app) return { ok: false, error: 'unknown app' };
  if (state.build.running) return { ok: false, busy: true, error: `already building ${state.build.app}` };

  const deviceList = await adbDevices();
  const ready = deviceList.filter((d) => d.status === 'device');
  if (mode === 'install' && ready.length === 0) {
    return { ok: false, error: 'Koi phone connected nahi. USB lagao ya wireless adb connect karo.' };
  }

  const task = `${app.module}:${mode === 'install' ? 'installDebug' : 'assembleDebug'}`;
  const started = Date.now();
  state.build = { running: true, app: appKey, ok: null, startedAt: started, finishedAt: null, secs: null, mode, task };
  state.buildLog = [];
  broadcast('status', { build: state.build });
  const log = (line) => { pushRing(state.buildLog, line); broadcast('buildlog', { line }); };
  log(`$ gradlew ${task}`);

  const { code } = await run('gradlew.bat', [task, ...gradlewArgs(app)], { cwd: ANDROID, onLine: log });

  const secs = Math.round((Date.now() - started) / 100) / 10;
  const ok = code === 0;
  state.build = { running: false, app: appKey, ok, startedAt: started, finishedAt: Date.now(), secs, mode, task };

  if (ok && mode === 'install') {
    if (state.settings.autoReverse) await ensureReverse();
    if (state.settings.autoLaunch) await launchApp(appKey);
  }
  if (!ok) state.lastError = `build failed (${task})`;
  broadcast('status', { build: state.build });
  log(ok ? `[OK] ${task} in ${secs}s` : `[FAIL] ${task} after ${secs}s`);
  return { ok, secs, task };
}

async function launchApp(appKey) {
  const app = APPS[appKey];
  if (!app) return { ok: false };
  const pkg = appPkg(app);
  await adbShell(`am force-stop ${pkg}`);
  // Activity class hamesha `.MainActivity` nahi hota: manifest namespace (com.tourney.*)
  // aur applicationId (com.thunderesports.*) alag hain — isliye runtime par resolve karo.
  let component = `${pkg}/.MainActivity`;
  const resolved = await adbShell(`cmd package resolve-activity --brief ${pkg}`);
  const found = resolved.out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^[\w.]+\/[\w.$]+$/.test(s))
    .pop();
  if (found) component = found;
  const { code, out } = await adbShell(`am start -n ${component}`);
  broadcast('status', { launch: { app: appKey, pkg, component, ok: code === 0 } });
  return { ok: code === 0, pkg, component, out: out.slice(0, 300) };
}

async function stopApp(appKey) {
  const app = APPS[appKey];
  const pkg = appPkg(app);
  await adbShell(`am force-stop ${pkg}`);
  return { ok: true, pkg };
}

async function screenshot() {
  return new Promise((resolve) => {
    const child = spawn(ADB, ['exec-out', 'screencap', '-p'], { windowsHide: true });
    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null));
  });
}

// -------------------------------------------------------------------- logcat
function startLogcat() {
  if (state.logcat.proc) return;
  const proc = spawn(ADB, ['logcat', '-v', 'time'], { windowsHide: true });
  state.logcat.proc = proc;
  const onData = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (!line.trim()) continue;
      pushRing(state.logcat.lines, line);
      broadcast('logcat', { line });
    }
  };
  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);
  const done = () => { if (state.logcat.proc === proc) state.logcat.proc = null; };
  proc.on('error', done);
  proc.on('close', done);
}

function stopLogcat() {
  const p = state.logcat.proc;
  state.logcat.proc = null;
  if (p) { try { p.kill(); } catch {} }
}

// --------------------------------------------------------------------- watcher
const watchHandles = [];
function watchTargets() {
  const dirs = new Set();
  for (const app of Object.values(APPS)) for (const rel of app.watch) dirs.add(path.join(ROOT, rel));
  dirs.add(path.join(ANDROID, 'gradle'));
  return [...dirs].filter((d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
}

function appsForFile(file) {
  const rel = file.replace(/\\/g, '/');
  const hit = [];
  for (const app of Object.values(APPS)) {
    if (rel.includes(`app-${app.key}/`)) { hit.push(app.key); continue; }
  }
  if (hit.length) return hit;
  if (rel.includes('/core/')) return state.settings.autoTarget === 'both' ? ['player', 'admin'] : [state.settings.autoTarget];
  return [];
}

function onFileChange(file) {
  state.watcher.lastFile = path.relative(ROOT, file).replace(/\\/g, '/');
  state.watcher.hits += 1;
  if (state.watcher.timer) clearTimeout(state.watcher.timer);
  state.watcher.timer = setTimeout(async () => {
    state.watcher.timer = null;
    if (!state.watcher.on) return;
    const targets = appsForFile(file);
    const note = (r) => {
      if (r && r.error) {
        state.lastError = r.error;
        broadcast('status', { warn: r.error });
      }
    };
    for (const t of targets) {
      if (state.build.running) { state.queue.push(t); continue; }
      note(await buildApp(t, 'install'));
    }
    while (state.queue.length) {
      const next = state.queue.shift();
      if (!state.build.running) note(await buildApp(next, 'install'));
    }
    broadcast('status', { watcher: { on: state.watcher.on, hits: state.watcher.hits, lastFile: state.watcher.lastFile } });
  }, WATCH_DEBOUNCE_MS);
}

function startWatcher() {
  if (state.watcher.on) return { ok: true, on: true };
  for (const dir of watchTargets()) {
    try {
      const w = fs.watch(dir, { recursive: true }, (_ev, filename) => {
        if (!filename) return;
        if (/\.(kt|kts|xml|json|toml|pro)$/i.test(String(filename))) onFileChange(path.join(dir, String(filename)));
      });
      watchHandles.push(w);
    } catch (err) {
      broadcast('status', { warn: `watch failed: ${dir} (${err.message})` });
    }
  }
  state.watcher.on = true;
  return { ok: true, on: true, dirs: watchHandles.length };
}

function stopWatcher() {
  for (const w of watchHandles) { try { w.close(); } catch {} }
  watchHandles.length = 0;
  if (state.watcher.timer) clearTimeout(state.watcher.timer);
  state.watcher = { ...state.watcher, on: false, timer: null };
  return { ok: true, on: false };
}


// ------------------------------------------------------------------ http layer
function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return {}; }
}

function lanUrls() {
  const out = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ iface: name, url: `http://${i.address}:${PORT}` });
    }
  }
  return out;
}

async function stateSnapshot() {
  const devices = await adbDevices();
  return {
    port: PORT,
    adbPath: ADB,
    devices,
    appPkgs: Object.fromEntries(Object.values(APPS).map((a) => [a.key, appPkg(a)])),
    build: state.build,
    watcher: { on: state.watcher.on, hits: state.watcher.hits, lastFile: state.watcher.lastFile },
    settings: state.settings,
    buildLog: state.buildLog.slice(-160),
    logcatTail: state.logcat.lines.slice(-80),
    lan: lanUrls(),
    apiBase: (process.env.DEV_CONSOLE_API_BASE || '(bundled client_config.json)'),
    lastError: state.lastError,
  };
}

const HTML = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0b0f14" />
<title>Dev Console</title>
<style>
  :root{
    --bg:#0b0f14; --card:#131a22; --card2:#0f1620; --line:#22303d;
    --fg:#e8f1f8; --dim:#8ba0b2; --acc:#23d18b; --acc2:#4aa8ff;
    --warn:#ffb300; --bad:#ff5c5c; --radius:14px;
  }
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;background:var(--bg);color:var(--fg);
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  body{padding:12px 12px 32px;max-width:640px;margin:0 auto}
  h1{font-size:15px;margin:0;letter-spacing:.02em}
  .top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
  .pill{font-size:11px;padding:4px 9px;border-radius:999px;border:1px solid var(--line);
    background:var(--card2);color:var(--dim);white-space:nowrap}
  .pill.ok{color:#04231a;background:var(--acc);border-color:var(--acc);font-weight:700}
  .pill.busy{color:#241a00;background:var(--warn);border-color:var(--warn);font-weight:700}
  .pill.bad{color:#2a0505;background:var(--bad);border-color:var(--bad);font-weight:700}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:12px;margin-bottom:10px}
  .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  button{font:inherit;font-weight:650;color:var(--fg);background:var(--card2);
    border:1px solid var(--line);border-radius:12px;padding:14px 10px;min-height:54px;
    display:flex;flex-direction:column;justify-content:center;gap:2px;cursor:pointer;
    transition:transform .06s ease, background .15s}
  button:active{transform:scale(.97);background:#1b2531}
  button small{font-weight:500;font-size:10.5px;color:var(--dim)}
  button.primary{background:linear-gradient(180deg,#1f7a5c,#155c45);border-color:#25a97c}
  button.primary small{color:#a9e8d1}
  button.blue{background:linear-gradient(180deg,#1b4f86,#143b66);border-color:#2f79c0}
  button.blue small{color:#a8cdf4}
  button.wide{grid-column:1 / -1}
  button.on{background:linear-gradient(180deg,#8a5b00,#6b4700);border-color:var(--warn)}
  label.sw{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dim)}
  select,input[type=text]{font:inherit;font-size:13px;color:var(--fg);background:var(--card2);
    border:1px solid var(--line);border-radius:10px;padding:9px 10px;min-height:44px}
  input[type=text]{flex:1;min-width:110px}
  .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:6px}
  .tabs{display:flex;gap:6px;margin-bottom:8px}
  .tab{flex:1;text-align:center;font-size:12.5px;font-weight:600;padding:9px;border-radius:10px;
    background:var(--card2);border:1px solid var(--line);color:var(--dim);cursor:pointer}
  .tab.active{color:var(--fg);border-color:var(--acc2);background:#132030}
  pre.log{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;
    line-height:1.45;background:#080c11;border:1px solid var(--line);border-radius:10px;
    padding:9px;height:44vh;overflow:auto;white-space:pre-wrap;word-break:break-word;color:#b9cbd9}
  pre.log .e{color:#ff8a8a}
  .shot{width:100%;border-radius:10px;border:1px solid var(--line);background:#080c11;display:block}
  .muted{font-size:11px;color:var(--dim);line-height:1.5}
  .dev{font-family:ui-monospace,monospace;font-size:11px;padding:3px 7px;border-radius:8px;
    background:var(--card2);border:1px solid var(--line)}
  .dev.live{border-color:var(--acc);color:var(--acc)}
</style></head><body>
<div class="top">
  <h1>⚡ Dev Console</h1>
  <span id="devPill" class="pill">no device</span>
  <span id="buildPill" class="pill">idle</span>
</div>

<div class="card">
  <div class="lbl">Build &amp; install</div>
  <div class="grid">
    <button class="primary" id="bPlayer">Player<small>build + install + launch</small></button>
    <button class="blue" id="bAdmin">Admin<small>build + install + launch</small></button>
    <button id="bLaunch">Launch<small>app kholo</small></button>
    <button id="bStop">Force stop<small>band karo</small></button>
  </div>
</div>

<div class="card">
  <div class="lbl">Auto-build on save (file save = phone me install)</div>
  <div class="grid">
    <button class="wide" id="bWatch">Watcher OFF<small>tap to start watching android/</small></button>
  </div>
  <div class="row" style="margin-top:10px">
    <label class="sw"><input type="checkbox" id="cbLaunch" checked> auto launch</label>
    <label class="sw"><input type="checkbox" id="cbReverse" checked> adb reverse 5000</label>
    <select id="selTarget">
      <option value="player">core → player</option>
      <option value="admin">core → admin</option>
      <option value="both">core → both</option>
    </select>
  </div>
</div>

<div class="card">
  <div class="lbl">Device</div>
  <div class="row" id="devList"><span class="muted">checking…</span></div>
  <div class="row" style="margin-top:10px">
    <button class="wide" id="bReverse">Reconnect adb reverse<small>backend 5000 + console 5199</small></button>
  </div>
  <div class="row" style="margin-top:10px">
    <input type="text" id="wirelessIp" placeholder="phone IP:5555 (wireless adb)" inputmode="numeric" />
    <button id="bConnect" style="min-height:44px;padding:10px 14px">Connect</button>
  </div>
  <div class="muted" id="lanInfo" style="margin-top:8px"></div>
</div>

<div class="card">
  <div class="lbl">Live output</div>
  <div class="tabs">
    <div class="tab active" data-tab="build">Build</div>
    <div class="tab" data-tab="logcat">Logcat</div>
    <div class="tab" data-tab="screen">Screen</div>
  </div>
  <div id="paneBuild"><pre class="log" id="logBuild"></pre></div>
  <div id="paneLogcat" style="display:none">
    <div class="row" style="margin-bottom:8px">
      <input type="text" id="logFilter" placeholder="filter (tourney, AndroidRuntime…)" />
      <button id="bClearLog" style="min-height:44px;padding:10px 14px">Clear</button>
    </div>
    <pre class="log" id="logLogcat"></pre>
  </div>
  <div id="paneScreen" style="display:none">
    <img class="shot" id="shotImg" alt="phone screenshot" />
    <div class="row" style="margin-top:8px">
      <button class="wide" id="bShot">Refresh screenshot<small>phone ki screen</small></button>
    </div>
  </div>
</div>

<script>
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function setBuildPill(b) {
  const el = $('#buildPill');
  if (!b) { el.className = 'pill'; el.textContent = 'idle'; return; }
  if (b.running) { el.className = 'pill busy'; el.textContent = 'building ' + b.app + '…'; return; }
  if (b.ok === true) { el.className = 'pill ok'; el.textContent = b.app + ' ok ' + (b.secs ?? '?') + 's'; return; }
  if (b.ok === false) { el.className = 'pill bad'; el.textContent = b.app + ' failed'; return; }
  el.className = 'pill'; el.textContent = 'idle';
}
function setDevices(devices) {
  const live = (devices || []).filter((d) => d.status === 'device');
  const pill = $('#devPill');
  pill.className = 'pill ' + (live.length ? 'ok' : 'bad');
  pill.textContent = live.length ? live.length + ' device' : 'no device';
  $('#devList').innerHTML = (devices || []).length
    ? devices.map((d) => '<span class="dev ' + (d.status === 'device' ? 'live' : '') + '">' + esc(d.serial) + ' · ' + esc(d.status) + '</span>').join('')
    : '<span class="muted">Koi phone nahi mila — USB lagao ya wireless adb connect karo.</span>';
}
function setWatch(w) {
  const b = $('#bWatch');
  b.className = 'wide' + (w.on ? ' on' : '');
  b.innerHTML = (w.on ? 'Watcher ON ●' : 'Watcher OFF')
    + '<small>' + (w.on ? 'last: ' + esc(w.lastFile || '—') + ' (' + w.hits + ')' : 'tap to start watching android/') + '</small>';
}
function appendLog(box, line, max, isErr) {
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  const d = document.createElement('div');
  if (isErr) d.className = 'e';
  d.textContent = line;
  box.appendChild(d);
  while (box.childElementCount > max) box.removeChild(box.firstChild);
  if (atBottom) box.scrollTop = box.scrollHeight;
}
const pushLog = (line) => appendLog($('#logBuild'), line, 500, /error|FAILED|Exception|FAIL\]/i.test(line));
function pushLogcat(line) {
  const f = $('#logFilter').value.trim().toLowerCase();
  if (f && line.toLowerCase().indexOf(f) === -1) return;
  appendLog($('#logLogcat'), line, 400, false);
}

async function api(path, body) {
  const opts = body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  };
  try { const r = await fetch(path, opts); return await r.json(); } catch (e) { return {}; }
}

let loaded = false;
async function refresh() {
  const s = await api('/api/state');
  setDevices(s.devices);
  setBuildPill(s.build);
  if (s.watcher) setWatch(s.watcher);
  if (s.settings) {
    $('#selTarget').value = s.settings.autoTarget;
    $('#cbLaunch').checked = !!s.settings.autoLaunch;
    $('#cbReverse').checked = !!s.settings.autoReverse;
  }
  if (!loaded) {
    (s.buildLog || []).forEach(pushLog);
    (s.logcatTail || []).forEach(pushLogcat);
    loaded = true;
  }
  $('#lanInfo').textContent = (s.lan || []).length
    ? 'Wi-Fi se bhi khulta hai: ' + s.lan.map((l) => l.url).join('   ')
    : '';
}

const targetApp = () => ($('#selTarget').value === 'admin' ? 'admin' : 'player');
$('#bPlayer').onclick = () => api('/api/build', { app: 'player', mode: 'install' });
$('#bAdmin').onclick = () => api('/api/build', { app: 'admin', mode: 'install' });
$('#bLaunch').onclick = () => api('/api/launch', { app: targetApp() });
$('#bStop').onclick = () => api('/api/stop', { app: targetApp() });
$('#bReverse').onclick = () => api('/api/reverse', {});
$('#bConnect').onclick = () => api('/api/adb', { action: 'connect', target: $('#wirelessIp').value.trim() });
$('#bClearLog').onclick = () => { $('#logLogcat').innerHTML = ''; api('/api/logcat', {}); };
$('#bWatch').onclick = async () => {
  const on = !$('#bWatch').classList.contains('on');
  await api('/api/watch', { on });
  const s = await api('/api/state');
  if (s.watcher) setWatch(s.watcher);
};
$('#selTarget').onchange = (e) => api('/api/settings', { autoTarget: e.target.value });
$('#cbLaunch').onchange = (e) => api('/api/settings', { autoLaunch: e.target.checked });
$('#cbReverse').onchange = (e) => api('/api/settings', { autoReverse: e.target.checked });

document.querySelectorAll('.tab').forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    const tab = t.dataset.tab;
    $('#paneBuild').style.display = tab === 'build' ? '' : 'none';
    $('#paneLogcat').style.display = tab === 'logcat' ? '' : 'none';
    $('#paneScreen').style.display = tab === 'screen' ? '' : 'none';
    if (tab === 'screen') loadShot();
    if (tab === 'logcat') $('#logLogcat').scrollTop = $('#logLogcat').scrollHeight;
  };
});

let shotBust = 0;
function loadShot() { $('#shotImg').src = '/api/screenshot?t=' + (++shotBust); }
$('#bShot').onclick = loadShot;

const es = new EventSource('/api/events');
es.addEventListener('buildlog', (e) => pushLog(JSON.parse(e.data).line));
es.addEventListener('logcat', (e) => pushLogcat(JSON.parse(e.data).line));
es.addEventListener('status', (e) => {
  const d = JSON.parse(e.data);
  if (d.build) setBuildPill(d.build);
  if (d.watcher) setWatch(d.watcher);
  if (d.launch) pushLog('[launch] ' + d.launch.pkg + ' ' + (d.launch.ok ? 'started' : 'failed'));
  if (d.warn) pushLog('[warn] ' + d.warn);
});
es.onerror = () => { loaded = false; };

setInterval(refresh, 4000);
refresh();
</script>
</body></html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(HTML);
  }

  if (p === '/api/state') return json(res, 200, await stateSnapshot());

  if (p === '/api/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write('event: hello\ndata: {}\n\n');
    state.sse.add(res);
    startLogcat();
    const keep = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 15000);
    req.on('close', () => {
      clearInterval(keep);
      state.sse.delete(res);
      if (state.sse.size === 0) stopLogcat();
    });
    return;
  }

  if (p === '/api/screenshot') {
    const buf = await screenshot();
    if (!buf) { res.writeHead(503); return res.end('no screenshot'); }
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return res.end(buf);
  }

  if (p === '/api/build' && req.method === 'POST') {
    const body = await readBody(req);
    const app = body.app === 'admin' ? 'admin' : 'player';
    const mode = body.mode === 'assemble' ? 'assemble' : 'install';
    json(res, 202, { accepted: true, app, mode });
    // Fire-and-forget: panel SSE se progress dekhta hai.
    buildApp(app, mode).then((r) => {
      if (r && r.error) {
        state.lastError = r.error;
        broadcast('status', { warn: r.error });
      }
    });
    return;
  }
  if (p === '/api/launch' && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, 200, await launchApp(body.app === 'admin' ? 'admin' : 'player'));
  }
  if (p === '/api/stop' && req.method === 'POST') {
    const body = await readBody(req);
    return json(res, 200, await stopApp(body.app === 'admin' ? 'admin' : 'player'));
  }
  if (p === '/api/watch' && req.method === 'POST') {
    const body = await readBody(req);
    const r = body.on ? startWatcher() : stopWatcher();
    broadcast('status', { watcher: { on: state.watcher.on, hits: state.watcher.hits, lastFile: state.watcher.lastFile } });
    return json(res, 200, r);
  }
  if (p === '/api/settings' && req.method === 'POST') {
    const body = await readBody(req);
    if (['player', 'admin', 'both'].indexOf(body.autoTarget) !== -1) state.settings.autoTarget = body.autoTarget;
    if (typeof body.autoLaunch === 'boolean') state.settings.autoLaunch = body.autoLaunch;
    if (typeof body.autoReverse === 'boolean') state.settings.autoReverse = body.autoReverse;
    return json(res, 200, state.settings);
  }
  if (p === '/api/reverse' && req.method === 'POST') {
    return json(res, 200, { results: await ensureReverse() });
  }
  if (p === '/api/adb' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.action === 'connect' && body.target) {
      if (!/^[\w.\-]+:\d+$/.test(body.target)) return json(res, 400, { ok: false, error: 'IP:port format chahiye' });
      const r = await adb(['connect', body.target], { timeoutMs: 25000 });
      return json(res, 200, { ok: r.code === 0, out: r.out.trim() });
    }
    if (body.action === 'devices') return json(res, 200, { devices: await adbDevices() });
    return json(res, 400, { ok: false, error: 'unknown action' });
  }
  if (p === '/api/logcat' && req.method === 'POST') {
    state.logcat.lines.length = 0;
    return json(res, 200, { ok: true });
  }
  if (p === '/api/logcat') {
    const f = (url.searchParams.get('filter') || '').toLowerCase();
    const lines = state.logcat.lines.filter((l) => !f || l.toLowerCase().indexOf(f) !== -1);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end(lines.join('\n'));
  }

  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log('  Phone Dev Console ready');
  console.log(`     laptop : http://localhost:${PORT}`);
  for (const l of lanUrls()) console.log(`     wi-fi  : ${l.url}  (${l.iface})`);
  console.log(`     adb    : ${ADB}`);
  const devices = await adbDevices();
  const live = devices.filter((d) => d.status === 'device');
  if (live.length) {
    await ensureReverse();
    console.log(`     phone  : ${live.map((d) => d.serial).join(', ')} — adb reverse tcp:5000/tcp:${PORT} done`);
  } else {
    console.log('     phone  : koi device nahi — USB lagao ya panel se wireless connect karo');
  }
  console.log('     stop   : Ctrl+C');
  console.log('');
});

process.on('SIGINT', () => {
  stopWatcher();
  stopLogcat();
  server.close(() => process.exit(0));
});
