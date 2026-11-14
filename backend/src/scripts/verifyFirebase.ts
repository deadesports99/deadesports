/**
 * One-command proof that Phases 1–5 actually work against the *real* Firebase project.
 *
 *   cd backend && npm run verify:firebase
 *
 * Why this exists: every phase was verified with unit tests and a real HTTP smoke,
 * but a Firestore write, a Storage upload and a stats document can only be proven on
 * a machine that holds the service account. This script is that machine's checklist,
 * collapsed into one command with an honest verdict:
 *
 *   - it FAILS if nothing was verified (all checks skipped is not a pass);
 *   - it never prints a credential;
 *   - it deletes everything it created, except today's stats snapshot (correct data,
 *     idempotent, rebuilt nightly anyway);
 *   - it never touches player data, never sends a player-visible event, and never
 *     changes your `.env`.
 *
 * Optional: `--only=phase1,phase4` runs a subset.
 */
import 'dotenv/config';
import {
  buildVerifyDocId,
  isVerifyDocument,
  maskServiceAccountEmail,
  summarise,
  type CheckResult,
  type CheckStatus,
} from '../services/verifyReport.js';
import { env } from '../config/env.js';

const CHECK_TIMEOUT_MS = 25_000;
const VERIFY_COLLECTION = '_verify';

/** 1×1 transparent PNG — passes the magic-number sniff in mediaStorage.service. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

type Outcome = { status: CheckStatus; detail?: string };

interface Ctx {
  app: unknown | null;
  db: any | null;
  docId: string;
  tenantId: string | null;
  mirrorDocId: string | null;
  storagePath: string | null;
}

const only = ((): string[] | null => {
  const arg = process.argv.find((value) => value.startsWith('--only='));
  if (!arg) return null;
  return arg
    .slice('--only='.length)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
})();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms).unref?.(),
    ),
  ]);
}

/**
 * Turn a raw Google API error into an actionable line. These four are the ones that
 * actually happen on a fresh project and each has a different fix, so guessing is
 * not acceptable in a tool people trust.
 */
export function hintFor(detail: string): string {
  if (/has not been used in project|is disabled/i.test(detail)) {
    return (
      `${detail}\n→ Fix: Google Cloud Console → APIs & Services → Library → enable ` +
      '"Cloud Firestore API" (and "Cloud Storage" if the storage check failed)'
    );
  }
  if (/requires an index/i.test(detail)) {
    return `${detail}\n→ Fix: firebase deploy --only firestore:indexes — then wait a few minutes for the build`;
  }
  if (/PERMISSION_DENIED|insufficient permissions/i.test(detail)) {
    return (
      `${detail}\n→ Fix: give the service account "Cloud Datastore User" (Firestore) ` +
      'and "Storage Object Admin" (Storage) roles'
    );
  }
  if (/bucket does not exist/i.test(detail)) {
    return `${detail}\n→ Fix: set FIREBASE_STORAGE_BUCKET=<projectId>.appspot.com for legacy projects`;
  }
  if (/private_key|invalid_grant|DECODER|no Firebase app|could not be used/i.test(detail)) {
    return (
      `${detail}\n→ Fix: re-download the service-account JSON (a wrong project, a truncated ` +
      'private_key or a deleted key all fail here)'
    );
  }
  return detail;
}

async function getDb(ctx: Ctx): Promise<any> {
  if (ctx.db) return ctx.db;
  const { getFirestore } = await import('firebase-admin/firestore');
  ctx.db = getFirestore(ctx.app as never);
  return ctx.db;
}

// ─── Checks ─────────────────────────────────────────────────────────────

async function checkCredentials(): Promise<Outcome> {
  const missing: string[] = [];
  if (!env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!env.FCM_CREDENTIALS_JSON) missing.push('FCM_CREDENTIALS_JSON');
  if (missing.length > 0) {
    return {
      status: 'fail',
      detail: `missing ${missing.join(', ')} — the Admin SDK cannot authenticate without a service account`,
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(env.FCM_CREDENTIALS_JSON ?? '') as Record<string, unknown>;
  } catch {
    return { status: 'fail', detail: 'FCM_CREDENTIALS_JSON is not valid JSON (needs one-line JSON)' };
  }

  const absent = ['project_id', 'client_email', 'private_key'].filter((key) => !parsed[key]);
  if (absent.length > 0) {
    return { status: 'fail', detail: `service account JSON is missing ${absent.join(', ')}` };
  }

  const note =
    parsed.project_id === env.FIREBASE_PROJECT_ID
      ? ''
      : ` · ⚠ service account project "${String(parsed.project_id)}" ≠ FIREBASE_PROJECT_ID "${env.FIREBASE_PROJECT_ID}"`;

  // Shape alone is not enough — a truncated private_key or a deleted key parses fine
  // and then fails everywhere else with an unreadable error. Prove it initialises.
  const { getFirebaseApp } = await import('../services/firebase.service.js');
  if (!getFirebaseApp()) {
    return {
      status: 'fail',
      detail: 'the service account JSON parses but the Admin SDK could not initialise with it',
    };
  }

  return {
    status: 'pass',
    detail: `project ${String(parsed.project_id)} · ${maskServiceAccountEmail(parsed.client_email)}${note}`,
  };
}

async function checkFirestoreRoundTrip(ctx: Ctx): Promise<Outcome> {
  if (!ctx.app) return { status: 'fail', detail: 'no Firebase app — the Admin SDK never initialised' };
  const db = await getDb(ctx);
  const ref = db.collection(VERIFY_COLLECTION).doc(ctx.docId);

  await ref.set({ check: 'firestore-roundtrip', at: new Date().toISOString() });
  const snapshot = await ref.get();
  if (!snapshot.exists) return { status: 'fail', detail: 'write succeeded but the document could not be read back' };

  const payload = snapshot.data() as { check?: string };
  await ref.delete();

  return {
    status: 'pass',
    detail: `wrote + read + deleted ${VERIFY_COLLECTION}/${ctx.docId} (got check="${payload.check ?? '?'}")`,
  };
}

async function checkPhase1Mirror(ctx: Ctx): Promise<Outcome> {
  const { liveMirrorService } = await import('../services/liveMirror.service.js');
  liveMirrorService.init();

  if (!liveMirrorService.isEnabled()) {
    return {
      status: 'skip',
      detail: 'FIREBASE_LIVE_MIRROR=false — set it to true and re-run to prove the write path',
    };
  }

  const before = liveMirrorService.stats();
  liveMirrorService.publish(
    {
      type: 'MIRROR_PING',
      data: { source: 'verify-script', note: 'safe to delete' },
      timestamp: new Date().toISOString(),
    },
    { audience: 'ALL', ...(ctx.tenantId ? { tenantId: ctx.tenantId } : {}) },
  );
  await liveMirrorService.flush();
  const after = liveMirrorService.stats();

  if (after.written <= before.written) {
    return {
      status: 'fail',
      detail: `no document written (queued=${after.queued ?? '?'} dropped=${after.dropped ?? '?'} written=${after.written})`,
    };
  }

  // Prove it is really in Firestore, not just counted in memory.
  const db = await getDb(ctx);
  const found = await db
    .collection(env.FIREBASE_LIVE_MIRROR_COLLECTION)
    .where('type', '==', 'MIRROR_PING')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (found.empty) {
    return { status: 'fail', detail: `stats say written=${after.written} but no MIRROR_PING document is readable` };
  }

  ctx.mirrorDocId = found.docs[0]!.id;
  const data = found.docs[0]!.data() as { tenantId?: string; expireAt?: unknown };
  ctx.tenantId = ctx.tenantId ?? data.tenantId ?? null;

  return {
    status: 'pass',
    detail:
      `document ${found.docs[0]!.id} in "${env.FIREBASE_LIVE_MIRROR_COLLECTION}"` +
      ` · tenantId ${data.tenantId ?? '(none)'} · expireAt ${data.expireAt ? 'set (TTL)' : 'MISSING'}`,
  };
}

async function checkPhase2Feed(ctx: Ctx): Promise<Outcome> {
  if (env.LIVE_FEED_ENABLED !== 'true') {
    return {
      status: 'skip',
      detail: 'LIVE_FEED_ENABLED=false — set it to true and re-run to prove the read path + indexes',
    };
  }
  if (!ctx.tenantId) {
    return { status: 'skip', detail: 'no tenantId available (no active tenant in the database, and no mirror event)' };
  }

  const { liveFeedService } = await import('../services/liveFeed.service.js');
  const result = await liveFeedService.read(
    { userId: 'verify-script', tenantId: ctx.tenantId },
    Date.now() - 15 * 60 * 1000,
    10,
  );

  if (result.source !== 'firestore') {
    return {
      status: 'fail',
      detail: `source="${result.source}" instead of "firestore" — usually a missing composite index or Firestore rules/quota`,
    };
  }

  const budget = await liveFeedService.budget(ctx.tenantId);
  return {
    status: 'pass',
    detail:
      `${result.events.length} event(s) read for tenant ${ctx.tenantId}` +
      ` · budget ${budget.used}/${budget.monthlyLimit} this month` +
      (ctx.mirrorDocId ? ' · includes the MIRROR_PING written by Phase 1' : ''),
  };
}

async function checkPhase4Storage(ctx: Ctx): Promise<Outcome> {
  if (!ctx.app) return { status: 'fail', detail: 'no Firebase app — the Admin SDK never initialised' };

  const { mediaStorageService } = await import('../services/mediaStorage.service.js');
  const originalFlag = env.MEDIA_UPLOAD_ENABLED;

  // The service gates on the env flag; flip it in-process only (your .env is untouched)
  // so the bucket can be proven even while the endpoint is still disabled.
  env.MEDIA_UPLOAD_ENABLED = 'true';
  try {
    const result = await mediaStorageService.upload({
      tenantId: ctx.tenantId ?? '00000000-0000-0000-0000-000000000000',
      purpose: 'match-screenshot',
      buffer: PIXEL_PNG,
    });
    ctx.storagePath = result.path;

    // Prove the returned URL is publicly readable without credentials (token URL).
    const response = await withTimeout(fetch(result.url), CHECK_TIMEOUT_MS, 'download URL fetch');
    if (!response.ok) {
      return {
        status: 'fail',
        detail: `uploaded to ${result.path} but the download URL returned HTTP ${response.status}`,
      };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/png')) {
      return { status: 'fail', detail: `download URL served content-type "${contentType}" instead of image/png` };
    }
    const bytes = (await response.arrayBuffer()).byteLength;

    return {
      status: 'pass',
      detail:
        `${result.path} in "${result.bucket}" · ${bytes} bytes served as image/png` +
        ` · permanent token URL (no expiry)`,
    };
  } finally {
    env.MEDIA_UPLOAD_ENABLED = originalFlag;
  }
}

async function checkPhase5Stats(ctx: Ctx): Promise<Outcome> {
  const { statsExportService } = await import('../services/statsExport.service.js');
  statsExportService.resetForTesting();

  const result = await statsExportService.run({ days: 1, force: true });
  if (!result.enabled) {
    return { status: 'fail', detail: `export refused: ${result.skippedReason}` };
  }
  if (result.written === 0) {
    return {
      status: 'skip',
      detail: `no active tenant to snapshot (${result.failed} failure(s))`,
    };
  }

  const db = await getDb(ctx);
  const snapshot = await db.collection(env.STATS_EXPORT_COLLECTION).limit(1).get();
  if (snapshot.empty) {
    return { status: 'fail', detail: `${result.written} snapshot(s) reported but "${env.STATS_EXPORT_COLLECTION}" is empty` };
  }

  const doc = snapshot.docs[0]!;
  const data = doc.data() as { money?: { currency?: string }; counts?: Record<string, number> };

  return {
    status: 'pass',
    detail:
      `${result.written} snapshot(s) → ${env.STATS_EXPORT_COLLECTION}/${doc.id}` +
      ` · currency ${data.money?.currency ?? '?'} · ${Object.keys(data.counts ?? {}).length} counts` +
      ' · left in place (correct data, rebuilt nightly)',
  };
}

async function checkSecurityRules(): Promise<Outcome> {
  return {
    status: 'skip',
    detail:
      'cannot be checked with a service account (Admin SDK bypasses rules). Deploy with ' +
      '`firebase deploy --only firestore:rules,storage --project <id>` and confirm the console shows no public access',
  };
}

// ─── Cleanup ────────────────────────────────────────────────────────────

async function cleanup(ctx: Ctx): Promise<void> {
  if (ctx.db) {
    const db = await getDb(ctx);
    try {
      const docs = await db.collection(VERIFY_COLLECTION).where('check', '==', 'firestore-roundtrip').get();
      for (const doc of docs.docs) {
        if (isVerifyDocument(doc.id)) await doc.ref.delete();
      }
      if (ctx.mirrorDocId) {
        await db.collection(env.FIREBASE_LIVE_MIRROR_COLLECTION).doc(ctx.mirrorDocId).delete();
        console.log(`   cleanup: removed mirror document ${ctx.mirrorDocId}`);
      }
    } catch (err) {
      console.warn('   cleanup (firestore):', (err as Error).message);
    }
  }

  if (ctx.storagePath && ctx.app) {
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const bucketName =
        env.FIREBASE_STORAGE_BUCKET || `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
      await getStorage(ctx.app as never).bucket(bucketName).file(ctx.storagePath).delete();
      console.log(`   cleanup: removed storage object ${ctx.storagePath}`);
    } catch (err) {
      console.warn('   cleanup (storage):', (err as Error).message);
    }
  }
}

// ─── Runner ─────────────────────────────────────────────────────────────

const SPECS: { id: string; phase: string; label: string; run: (ctx: Ctx) => Promise<Outcome> }[] = [
  { id: 'credentials', phase: 'Setup', label: 'service account', run: checkCredentials },
  { id: 'firestore', phase: 'Setup', label: 'Firestore round-trip', run: checkFirestoreRoundTrip },
  { id: 'phase1', phase: 'Phase 1', label: 'live mirror write', run: checkPhase1Mirror },
  { id: 'phase2', phase: 'Phase 2', label: 'live feed read + budget', run: checkPhase2Feed },
  { id: 'phase4', phase: 'Phase 4', label: 'Storage upload + public URL', run: checkPhase4Storage },
  { id: 'phase5', phase: 'Phase 5', label: 'stats snapshot document', run: checkPhase5Stats },
  { id: 'rules', phase: 'All', label: 'security rules (manual)', run: checkSecurityRules },
];

async function main(): Promise<void> {
  const { getFirebaseApp } = await import('../services/firebase.service.js');
  const { prisma, disconnectPrisma } = await import('../config/prisma.js');

  const ctx: Ctx = {
    app: getFirebaseApp(),
    db: null,
    docId: buildVerifyDocId(),
    tenantId: null,
    mirrorDocId: null,
    storagePath: null,
  };

  try {
    ctx.tenantId = await prisma.tenant
      .findFirst({ where: { isActive: true }, select: { id: true } })
      .then((tenant) => tenant?.id ?? null)
      .catch(() => null);
  } catch {
    ctx.tenantId = null;
  }

  console.log('\n🔎 Firebase verification — Phases 1–5');
  console.log(`   project     : ${env.FIREBASE_PROJECT_ID || '(unset)'}`);
  console.log(`   tenant scope: ${ctx.tenantId ?? '(none)'}`);
  if (only) console.log(`   running only: ${only.join(', ')}`);
  console.log('');

  const results: CheckResult[] = [];

  const runOne = async (spec: (typeof SPECS)[number]): Promise<CheckResult> => {
    const started = Date.now();
    let outcome: Outcome;
    try {
      outcome = await withTimeout(spec.run(ctx), CHECK_TIMEOUT_MS, spec.label);
    } catch (err) {
      outcome = { status: 'fail', detail: (err as Error).message };
    }
    const detail = outcome.detail ? hintFor(outcome.detail) : undefined;
    return {
      id: spec.id,
      phase: spec.phase,
      label: spec.label,
      status: outcome.status,
      ...(detail ? { detail } : {}),
      ms: Date.now() - started,
    };
  };

  const [credentialsSpec, ...rest] = SPECS as [(typeof SPECS)[number], ...typeof SPECS];

  // Credentials first: without them every other check would fail with the same wall
  // of text, which buries the one line the operator actually has to fix.
  const credentialResult = await runOne(credentialsSpec);
  results.push(credentialResult);

  const blocked = credentialResult.status !== 'pass';

  for (const spec of rest) {
    if (only && spec.phase !== 'Setup' && !only.includes(spec.id)) continue;
    if (blocked) {
      results.push({
        id: spec.id,
        phase: spec.phase,
        label: spec.label,
        status: 'skip',
        detail: 'blocked by Setup — fix the service account above, then re-run',
      });
      continue;
    }
    results.push(await runOne(spec));
  }

  await cleanup(ctx);

  const summary = summarise(results);
  console.log(summary.lines.join('\n'));
  console.log(`\n${summary.headline}\n`);

  if (summary.exitCode === 0) {
    console.log('Safe next step: enable the phases in `.env`, restart, and watch the first few events.\n');
  } else if (summary.failed > 0) {
    console.log('Fix the FAIL lines above before enabling anything in production.\n');
  } else {
    console.log('Nothing ran. Set FCM_CREDENTIALS_JSON + the phase flags, then run this again.\n');
  }

  process.exitCode = summary.exitCode;
  await disconnectPrisma().catch(() => {});
}

void main().catch((err) => {
  console.error('✖ verify:firebase crashed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
