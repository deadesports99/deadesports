/**
 * Pure reporting helpers for `npm run verify:firebase`.
 *
 * Kept separate from the verification script so the *verdict logic* is unit-tested:
 * a verification tool that lies about its own result is worse than no tool.
 *
 * The one rule that matters: **skipped is not passed.** If every check skips (no
 * credentials, everything off), the command must still fail, otherwise a green run
 * on a server proves nothing.
 */

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  /** Stable machine id, e.g. `phase4-storage-upload`. */
  id: string;
  /** Human label, e.g. `Phase 4 — Storage upload`. */
  phase: string;
  label: string;
  status: CheckStatus;
  /** What actually happened — never contains secrets. */
  detail?: string;
  ms?: number;
}

export interface VerifySummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  exitCode: 0 | 1;
  headline: string;
  lines: string[];
}

const STATUS_TAG: Record<CheckStatus, string> = {
  pass: '  ✔ PASS ',
  fail: '  ✖ FAIL ',
  skip: '  – SKIP ',
};

export function describeStatus(status: CheckStatus): string {
  return STATUS_TAG[status];
}

export function summarise(results: CheckResult[]): VerifySummary {
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  const lines: string[] = [];
  for (const result of results) {
    const timing = typeof result.ms === 'number' ? ` (${result.ms}ms)` : '';
    lines.push(`${describeStatus(result.status)}${result.phase} — ${result.label}${timing}`);
    if (result.detail) {
      lines.push(`         ${result.detail.split('\n').join('\n         ')}`);
    }
  }

  let exitCode: 0 | 1 = 0;
  let headline: string;
  if (failed > 0) {
    exitCode = 1;
    headline = `✖ ${failed} of ${results.length} check(s) FAILED — do not enable these phases yet`;
  } else if (passed === 0) {
    exitCode = 1;
    headline = `⚠ Nothing was verified (${skipped} check(s) skipped) — this is NOT a pass`;
  } else {
    headline = `✔ ${passed} check(s) passed${skipped ? `, ${skipped} skipped` : ''}`;
  }

  return { total: results.length, passed, failed, skipped, exitCode, headline, lines };
}

/**
 * Show that a service-account email exists without leaking it into logs:
 * `firebase-adminsdk-abc@my-proj.iam.gserviceaccount.com` → `f***@my-proj.iam.gserviceaccount.com`.
 */
export function maskServiceAccountEmail(email: unknown): string {
  if (typeof email !== 'string' || email.length === 0) return '(missing)';
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/** Deterministic-per-run id for the throwaway documents the verifier writes. */
export function buildVerifyDocId(now: Date = new Date()): string {
  return `_verify_${now.toISOString().replace(/[:.]/g, '-')}`;
}

/** True when the document belongs to this verifier and is safe to delete. */
export function isVerifyDocument(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('_verify_');
}
