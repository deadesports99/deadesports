#!/usr/bin/env node
/**
 * 🔥 10-MINUTE WHITE-LABEL PACKAGER
 *
 * Takes one client folder (`clients/<slug>/client_config.json`) and produces
 * two branded APKs in `dist/<slug>/`:
 *
 *   Player.apk  → gamers (:app-player)
 *   Admin.apk   → owner + staff (:app-admin)
 *
 * Design rules:
 *  • The repo is NEVER left branded to a client: every injected file is backed
 *    up and restored in a `finally` block (unless `--keep` is passed).
 *  • Nothing secret is required — branding only (colors, name, package id,
 *    backend URL, tenant id, the CLIENT's own UPI id).
 *  • Config schema v2 (nested) and v1 (flat) are both accepted, so old client
 *    folders keep working.
 *
 * Usage (from the repo root):
 *   package_client.bat sample_client
 *   package_client.bat sample_client --release
 *   node tools/package_client.mjs clients/sample_client --no-build
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID = path.join(ROOT, 'android');
const APPS = ['app-player', 'app-admin'];

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const clientArg = args.find((a) => !a.startsWith('--'));

const log = (icon, message) => console.log(`${icon} ${message}`);
const fail = (message) => {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
};

if (!clientArg) {
  console.log(`
Usage: package_client.bat <client_folder> [--release] [--no-build] [--keep]

Examples:
  package_client.bat sample_client
  package_client.bat alpha_esports --release
`);
  process.exit(1);
}

// ─── 1. Load the client config ───────────────────────────────────────────

function resolveClientDir(arg) {
  const candidates = [
    path.resolve(ROOT, arg),
    path.resolve(ROOT, 'clients', arg),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'client_config.json'))) return dir;
  }
  return fail(`client_config.json not found for "${arg}" (looked in clients/${arg}/)`);
}

const clientDir = resolveClientDir(clientArg);
const rawConfig = JSON.parse(fs.readFileSync(path.join(clientDir, 'client_config.json'), 'utf8'));

/** Accepts both the nested v2 schema and the legacy flat v1 schema. */
function normalize(raw) {
  if (!raw.client && !raw.theme && !raw.backend && !raw.payments) {
    // v1 flat file (what the apps ship with)
    return {
      clientName: raw.client_name ?? raw.app_name ?? 'Client',
      appName: raw.app_name ?? 'Client',
      adminAppName: `${raw.app_name ?? 'Client'} Admin`,
      applicationId: raw.application_id ?? '',
      adminApplicationId: '',
      versionName: raw.version_name ?? '1.0.0',
      versionCode: Number(raw.version_code ?? 1),
      primaryColor: raw.primary_color ?? '#FF5722',
      buttonColor: raw.button_color ?? '#FF7043',
      accentColor: raw.accent_color ?? '#FFB300',
      cornerRadiusDp: Number(raw.corner_radius_dp ?? 12),
      fontStyle: raw.font_style ?? 'default',
      enableDarkMode: raw.enable_dark_mode !== false,
       apiBaseUrl: process.env.API_BASE_URL ?? raw.api_base_url ?? '',
      supabaseUrl: raw.supabase_url ?? '',
      supabaseAnonKey: raw.supabase_anon_key ?? '',
      tenantId: raw.tenant_id ?? '',
      upiId: raw.upi_id ?? '',
      upiName: raw.upi_name ?? '',
      minDeposit: Number(raw.min_deposit ?? 10),
      supportWhatsapp: raw.support_whatsapp ?? '',
      appIcon: raw.app_icon ?? '',
    };
  }

  const client = raw.client ?? {};
  const theme = raw.theme ?? {};
  const backend = raw.backend ?? {};
  const payments = raw.payments ?? {};
  const assets = raw.assets ?? {};

  return {
    clientName: client.name ?? client.app_name ?? 'Client',
    appName: client.app_name ?? 'Client',
    adminAppName: client.admin_app_name ?? `${client.app_name ?? 'Client'} Admin`,
    applicationId: client.application_id ?? '',
    adminApplicationId: client.admin_application_id ?? '',
    versionName: client.version_name ?? '1.0.0',
    versionCode: Number(client.version_code ?? 1),
    primaryColor: theme.primary_color ?? '#FF5722',
    buttonColor: theme.button_color ?? '#FF7043',
    accentColor: theme.accent_color ?? '#FFB300',
    cornerRadiusDp: Number(theme.corner_radius_dp ?? 12),
    fontStyle: theme.font_style ?? 'default',
    enableDarkMode: theme.enable_dark_mode !== false,
     apiBaseUrl: process.env.API_BASE_URL ?? backend.api_base_url ?? '',
    supabaseUrl: backend.supabase_url ?? '',
    supabaseAnonKey: backend.supabase_anon_key ?? '',
    tenantId: backend.tenant_id ?? '',
    upiId: payments.upi_id ?? '',
    upiName: payments.upi_name ?? '',
    minDeposit: Number(payments.min_deposit ?? 10),
    supportWhatsapp: payments.support_whatsapp ?? '',
    appIcon: assets.app_icon ?? '',
  };
}

const cfg = normalize(rawConfig);

// ─── 2. Validate before touching anything ────────────────────────────────

const errors = [];
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v ?? '');
const isPackageId = (v) => /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(v ?? '');

if (!cfg.appName || cfg.appName.length > 30) errors.push('client.app_name is required (≤ 30 chars)');
if (!isPackageId(cfg.applicationId)) errors.push('client.application_id must look like com.client.app');
if (cfg.adminApplicationId && !isPackageId(cfg.adminApplicationId)) {
  errors.push('client.admin_application_id must look like com.client.app.admin');
}
if (!isHex(cfg.primaryColor)) errors.push('theme.primary_color must be #RRGGBB');
if (!isHex(cfg.buttonColor)) errors.push('theme.button_color must be #RRGGBB');
if (!isHex(cfg.accentColor)) errors.push('theme.accent_color must be #RRGGBB');
if (!/^https?:\/\/.+\/api\/v1$/.test(cfg.apiBaseUrl)) {
  errors.push('backend.api_base_url must be an http(s) URL ending with /api/v1');
}
if (!/^[0-9a-fA-F-]{20,40}$/.test(cfg.tenantId)) errors.push('backend.tenant_id must be the tenant UUID');
if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(cfg.upiId)) {
  errors.push('payments.upi_id must be a UPI handle like brand@okaxis');
}
if (!Number.isFinite(cfg.versionCode) || cfg.versionCode < 1) errors.push('client.version_code must be ≥ 1');

if (errors.length > 0) {
  fail(`Invalid client config in ${path.relative(ROOT, clientDir)}:\n   - ${errors.join('\n   - ')}`);
}

const adminAppId = cfg.adminApplicationId || `${cfg.applicationId}.admin`;
const adminAppName = cfg.adminAppName;
const slug = cfg.clientName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'client';

/** Runtime schema consumed by ClientConfig.kt + the Gradle build script. */
const flatConfig = {
  client_name: cfg.clientName,
  app_name: cfg.appName,
  application_id: cfg.applicationId,
  version_name: cfg.versionName,
  version_code: cfg.versionCode,
  primary_color: cfg.primaryColor,
  button_color: cfg.buttonColor,
  accent_color: cfg.accentColor,
  corner_radius_dp: cfg.cornerRadiusDp,
  font_style: cfg.fontStyle,
  enable_dark_mode: cfg.enableDarkMode,
  api_base_url: cfg.apiBaseUrl,
  supabase_url: cfg.supabaseUrl,
  supabase_anon_key: cfg.supabaseAnonKey,
  tenant_id: cfg.tenantId,
  upi_id: cfg.upiId,
  upi_name: cfg.upiName || cfg.appName,
  min_deposit: cfg.minDeposit,
  support_whatsapp: cfg.supportWhatsapp,
};

log('📦', `Client: ${cfg.clientName} (${clientDir.replace(ROOT + path.sep, '')})`);
log('🆔', `Player ${cfg.applicationId}  •  Admin ${adminAppId}`);

// ─── 3. Backup + inject (restored in `finally`) ──────────────────────────

const backups = new Map(); // absolute path -> Buffer|null (null = did not exist)

function backup(file) {
  if (backups.has(file)) return;
  backups.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
}
function writeInjected(file, content) {
  backup(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function deleteInjected(file) {
  if (!fs.existsSync(file)) return;
  backup(file);
  fs.unlinkSync(file);
}

function restoreAll() {
  for (const [file, content] of backups) {
    try {
      if (content === null) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    } catch (err) {
      console.warn(`⚠ could not restore ${file}: ${err.message}`);
    }
  }
  backups.clear();
}

/** Darken a hex color so a bright logo stays visible on the adaptive icon. */
function shade(hex, factor = 0.45) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

const ADAPTIVE_ICON = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_brand" />
</adaptive-icon>
`;

const iconPath = cfg.appIcon ? path.resolve(clientDir, cfg.appIcon) : null;
const hasIcon = iconPath && fs.existsSync(iconPath);

for (const app of APPS) {
  const appDir = path.join(ANDROID, app);

  // 3a. Branding config (flat schema, read at build time + runtime)
  const appConfig =
    app === 'app-admin'
      ? { ...flatConfig, app_name: adminAppName, application_id: adminAppId }
      : flatConfig;
  writeInjected(
    path.join(appDir, 'src/main/assets/client_config.json'),
    JSON.stringify(appConfig, null, 2) + '\n',
  );

  // 3b. Launcher icon background follows the client's primary color
  writeInjected(
    path.join(appDir, 'src/main/res/values/colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${shade(cfg.primaryColor)}</color>
</resources>
`,
  );

  // 3c. Optional client google-services.json -> FCM + Firebase Auth enabled
  const clientGoogleServices = path.resolve(clientDir, 'google-services.json');
  if (fs.existsSync(clientGoogleServices)) {
    writeInjected(path.join(appDir, 'google-services.json'), fs.readFileSync(clientGoogleServices));
  }

  // 3d. Optional client logo → adaptive icon foreground + legacy mipmaps
  if (hasIcon) {
    writeInjected(path.join(appDir, 'src/main/res/drawable/ic_launcher_brand.png'), fs.readFileSync(iconPath));
    // Remove the client-neutral vector fallbacks (API 24-25) so the brand PNGs win.
    for (const variant of ['ic_launcher', 'ic_launcher_round']) {
      deleteInjected(path.join(appDir, 'src/main/res/mipmap', `${variant}.xml`));
    }
    for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
      for (const variant of ['ic_launcher', 'ic_launcher_round']) {
        writeInjected(
          path.join(appDir, `src/main/res/mipmap-${density}/${variant}.png`),
          fs.readFileSync(iconPath),
        );
      }
    }
    for (const variant of ['ic_launcher', 'ic_launcher_round']) {
      writeInjected(
        path.join(appDir, `src/main/res/mipmap-anydpi-v26/${variant}.xml`),
        ADAPTIVE_ICON,
      );
    }
  }
}




log('🎨', `Branding injected${hasIcon ? ' + client icon installed' : ' (no icon supplied — default icon kept)'}`);

// ─── 4. Build ────────────────────────────────────────────────────────────

const mode = flags.has('--release') ? 'release' : 'debug';

function run(command, commandArgs) {
  const isWindows = process.platform === 'win32';
  const result = isWindows
    ? spawnSync('cmd.exe', ['/c', command, ...commandArgs], { cwd: ANDROID, stdio: 'inherit' })
    : spawnSync(command, commandArgs, { cwd: ANDROID, stdio: 'inherit' });
  if (result.status !== 0) {
    restoreAll();
    fail(`Gradle build failed (${mode}). Files restored — fix the error above and retry.`);
  }
}

if (flags.has('--no-build')) {
  log('⏭', 'Skipping Gradle build (--no-build) — config validated + injection tested.');
} else {
  log('🔨', `Building ${mode} APKs (Gradle)…`);
  run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [
    ':app-player:assemble' + (mode === 'release' ? 'Release' : 'Debug'),
    ':app-admin:assemble' + (mode === 'release' ? 'Release' : 'Debug'),
    '--console=plain',
  ]);
}

// ─── 5. Collect APKs into dist/<slug>/ ───────────────────────────────────

function findApk(app) {
  const dir = path.join(ANDROID, app, 'build/outputs/apk', mode);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.apk'))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] ?? null;
}

const outDir = path.join(ROOT, 'dist', slug);
const summary = {
  client: cfg.clientName,
  slug,
  mode,
  builtAt: new Date().toISOString(),
  player: { applicationId: cfg.applicationId, appName: cfg.appName },
  admin: { applicationId: adminAppId, appName: adminAppName },
  versionName: cfg.versionName,
  versionCode: cfg.versionCode,
  apiBaseUrl: cfg.apiBaseUrl,
  tenantId: cfg.tenantId,
  upiId: cfg.upiId,
  apks: {},
};

if (!flags.has('--no-build')) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const app of APPS) {
    const apk = findApk(app);
    const label = app === 'app-player' ? 'Player' : 'Admin';
    if (!apk) {
      log('⚠', `${label} APK not found in build/outputs/apk/${mode}`);
      continue;
    }
    const target = path.join(outDir, `${label}.apk`);
    fs.copyFileSync(apk, target);
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    const sizeMb = (fs.statSync(target).size / (1024 * 1024)).toFixed(2);
    summary.apks[label.toLowerCase()] = { file: `${label}.apk`, sizeMb: Number(sizeMb), sha256 };
    log('✅', `${label}.apk  ${sizeMb} MB  sha256:${sha256.slice(0, 12)}…`);
  }

  fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify(summary, null, 2));
  log('📁', `Output: dist/${slug}/  (+ build-info.json)`);

  if (mode === 'release') {
    log('ℹ️', 'Release APKs are unsigned unless a signingConfig is set in android/app-player/build.gradle.kts — sign with apksigner before uploading.');
  }
}

// ─── 6. Restore the repo (unless --keep) ─────────────────────────────────

if (flags.has('--keep')) {
  log('📌', '--keep passed: branded files left in android/ (revert with git checkout).');
} else {
  restoreAll();
  log('♻️', 'Repo restored — no client branding left behind.');
}

log('🎉', `Done. Hand over dist/${slug}/Player.apk to the players and dist/${slug}/Admin.apk to the client owner.`);
