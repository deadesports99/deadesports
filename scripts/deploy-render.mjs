#!/usr/bin/env node
/**
 * Trigger a deploy of the live Render service.
 *
 * The service is attached to the public repo URL (no GitHub App), so Render
 * does not redeploy on push. Run this after `git push`:
 *
 *   RENDER_API_KEY=rnd_xxx node scripts/deploy-render.mjs
 *
 * Optional env:
 *   RENDER_SERVICE_ID  defaults to the spartan-arena service id
 *   RENDER_API_KEY     required — create at
 *                      https://dashboard.render.com/u/settings#api-keys
 *
 * Then poll the status with the same key:
 *   node scripts/deploy-render.mjs --status
 */
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-dbspjjc9v7es73b9tbf0';
const API = 'https://api.render.com/v1';
const KEY = process.env.RENDER_API_KEY;

if (!KEY) {
  console.error('RENDER_API_KEY is not set. Create one at https://dashboard.render.com/u/settings#api-keys');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${KEY}` };

async function status() {
  const res = await fetch(`${API}/services/${SERVICE_ID}/deploys?limit=1`, { headers: auth });
  if (!res.ok) throw new Error(`deploys ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const [latest] = await res.json();
  const d = latest.deploy;
  console.log(`status: ${d.status}  commit: ${d.commit?.id?.slice(0, 7) ?? '-'}  finished: ${d.finishedAt ?? '-'}`);
  return d.status;
}

async function deploy() {
  const res = await fetch(`${API}/services/${SERVICE_ID}/deploys`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`deploy ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  console.log('deploy queued');
}

if (process.argv.includes('--status')) {
  await status();
} else {
  await deploy();
  // Poll for up to 12 minutes so the command is useful on its own.
  for (let i = 0; i < 72; i += 1) {
    await new Promise((r) => setTimeout(r, 10_000));
    const s = await status();
    if (s === 'live' || s === 'failed' || s === 'canceled') break;
  }
}
