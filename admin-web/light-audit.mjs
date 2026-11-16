import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '../.tmp/lightmode';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
];

const ROUTES = [
  ['dashboard', '/'],
  ['matches', '/matches'],
  ['create', '/matches/create'],
  ['publish', '/matches/publish'],
  ['roster', '/roster'],
  ['wallet', '/wallet'],
  ['settlement', '/wallet/settlement'],
  ['players', '/players'],
  ['staff', '/staff'],
  ['settings', '/settings'],
];

// --- detect low-contrast text in LIGHT mode ---
function contrastFails() {
  function parse(c) {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function lum({ r, g, b }) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function bgOf(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.85) return c;
      n = n.parentElement;
    }
    return { r: 241, g: 245, b: 249, a: 1 };
  }
  const fails = [];
  document.querySelectorAll('p,span,li,td,th,label,button,a,h1,h2,h3,dt,dd,div').forEach((el) => {
    if (!el.textContent || !el.textContent.trim() || el.children.length > 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.6) return;
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    const l1 = lum(fg);
    const l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fs = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = fs >= 24 || (fs >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      fails.push({
        ratio: +ratio.toFixed(2),
        fs,
        color: cs.color,
        bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
        text: el.textContent.trim().slice(0, 40),
      });
    }
  });
  const seen = new Set();
  return fails.filter((f) => {
    const k = f.text + f.color;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function login() {
  const api = await chromium.launch();
  const ctx = await api.newContext();
  const r1 = await ctx.request.post('http://localhost:5000/api/v1/auth/admin/otp/request', {
    headers: { Origin: 'http://localhost:5174', 'Content-Type': 'application/json' },
    data: { email: 'deadesports99@gmail.com' },
  });
  const j1 = await r1.json();
  const otp = j1?.data?.debugOtp;
  if (!otp) {
    await api.close();
    return { cookies: null, reason: j1?.message ?? 'no debugOtp' };
  }
  await ctx.request.post('http://localhost:5000/api/v1/auth/admin/otp/verify', {
    headers: { Origin: 'http://localhost:5174', 'Content-Type': 'application/json' },
    data: { email: 'deadesports99@gmail.com', otp },
  });
  const cookies = (await ctx.storageState()).cookies;
  await api.close();
  return { cookies, reason: null };
}

const auth = await login();
const loggedIn = Boolean(auth.cookies);
console.log('login:', loggedIn ? 'OK' : 'FAILED — ' + auth.reason);

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  if (auth.cookies) await ctx.addCookies(auth.cookies);
  // Force light theme before any script runs
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('spartan.admin.theme.v1', 'light');
    } catch {}
  });

  const page = await ctx.newPage();
  const routes = loggedIn ? ROUTES : [['login', '/']];

  for (const [name, path] of routes) {
    await page.goto('http://localhost:5174' + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);

    const theme = await page.evaluate(() => ({
      light: document.documentElement.classList.contains('light'),
      dark: document.documentElement.classList.contains('dark'),
    }));

    await page.screenshot({ path: `${OUT}/${vp.name}-${name}.png`, fullPage: true });

    const fails = await page.evaluate(contrastFails);
    const overflow = await page.evaluate(
      (w) => document.documentElement.scrollWidth > w + 2,
      vp.width
    );

    const flags = [];
    if (!theme.light) flags.push('NOT-LIGHT');
    if (overflow) flags.push('OVERFLOW-X');
    if (fails.length) flags.push(`CONTRAST(${fails.length})`);

    console.log(`${vp.name.padEnd(8)} ${name.padEnd(11)} ${flags.length ? flags.join(' | ') : 'ok'}`);
    if (fails.length) console.log('   ', JSON.stringify(fails.slice(0, 6)));
  }
  await ctx.close();
}

await browser.close();
console.log('shots ->', OUT);
