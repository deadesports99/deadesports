/**
 * The verdict logic of `npm run verify:firebase`.
 *
 * These tests exist because a verification tool that reports success when it
 * verified nothing is actively dangerous: someone would flip five phases on in
 * production on the strength of a green line.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVerifyDocId,
  describeStatus,
  isVerifyDocument,
  maskServiceAccountEmail,
  summarise,
  type CheckResult,
} from '../src/services/verifyReport.js';

const check = (status: CheckResult['status'], overrides: Partial<CheckResult> = {}): CheckResult => ({
  id: 'x',
  phase: 'Phase 1',
  label: 'live mirror write',
  status,
  ...overrides,
});

describe('verifyReport — verdict', () => {
  it('passes only when every check passed', () => {
    const summary = summarise([check('pass'), check('pass')]);
    assert.equal(summary.exitCode, 0);
    assert.equal(summary.passed, 2);
    assert.match(summary.headline, /✔ 2 check\(s\) passed/);
  });

  it('fails if any check failed', () => {
    const summary = summarise([check('pass'), check('fail')]);
    assert.equal(summary.exitCode, 1);
    assert.equal(summary.failed, 1);
    assert.match(summary.headline, /1 of 2 check\(s\) FAILED/);
  });

  it('does NOT pass when everything was skipped', () => {
    const summary = summarise([check('skip'), check('skip')]);
    assert.equal(summary.exitCode, 1, 'all-skipped must never look like success');
    assert.match(summary.headline, /NOT a pass/);
  });

  it('treats skips as neutral when something real passed', () => {
    const summary = summarise([check('pass'), check('skip')]);
    assert.equal(summary.exitCode, 0);
    assert.equal(summary.skipped, 1);
    assert.match(summary.headline, /1 check\(s\) passed, 1 skipped/);
  });

  it('counts an empty run as not-verified', () => {
    const summary = summarise([]);
    assert.equal(summary.total, 0);
    assert.equal(summary.exitCode, 1);
  });
});

describe('verifyReport — output', () => {
  it('renders one line per check with its status and timing', () => {
    const summary = summarise([check('pass', { ms: 42 })]);
    assert.equal(summary.lines.length, 1);
    assert.match(summary.lines[0]!, /PASS/);
    assert.match(summary.lines[0]!, /Phase 1 — live mirror write/);
    assert.match(summary.lines[0]!, /\(42ms\)/);
  });

  it('indents multi-line details so they stay readable', () => {
    const summary = summarise([check('fail', { detail: 'line one\nline two' })]);
    assert.match(summary.lines[1]!, /^ {9}line one$/m);
    assert.match(summary.lines[1]!, /^ {9}line two$/m);
  });

  it('has a distinct tag per status', () => {
    const tags = new Set([describeStatus('pass'), describeStatus('fail'), describeStatus('skip')]);
    assert.equal(tags.size, 3);
  });
});

describe('verifyReport — secrets never leak', () => {
  it('masks the service account email but keeps the domain', () => {
    const masked = maskServiceAccountEmail('firebase-adminsdk-abc12@dade-865d2.iam.gserviceaccount.com');
    assert.equal(masked.startsWith('f***'), true);
    assert.equal(masked.includes('adminsdk'), false);
    assert.equal(masked.endsWith('@dade-865d2.iam.gserviceaccount.com'), true);
  });

  it('handles missing or malformed values', () => {
    assert.equal(maskServiceAccountEmail(undefined), '(missing)');
    assert.equal(maskServiceAccountEmail(''), '(missing)');
    assert.equal(maskServiceAccountEmail('no-at-sign'), '***');
  });
});

describe('verifyReport — throwaway document ids', () => {
  it('builds a filesystem-safe, per-run unique id', () => {
    const id = buildVerifyDocId(new Date('2026-11-12T09:50:35.730Z'));
    assert.equal(id, '_verify_2026-11-12T09-50-35-730Z');
    assert.equal(id.includes('/'), false);
  });

  it('only claims to own ids the verifier created', () => {
    assert.equal(isVerifyDocument('_verify_2026-11-12T09-50-35-730Z'), true);
    assert.equal(isVerifyDocument('53a09545-e6e2-4cf5'), false);
    assert.equal(isVerifyDocument(undefined), false);
  });
});
