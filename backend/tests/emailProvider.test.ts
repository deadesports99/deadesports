/**
 * Phase 6 — email providers + the per-account daily OTP cap.
 *
 * What this proves before a real key is ever pasted into `.env`:
 *  1. `brevo` and `resend` build the exact request their API expects;
 *  2. a provider failure throws (so the caller can drop the OTP row and 502);
 *  3. the code / key value never leaks into an error message or a log line;
 *  4. a missing key fails loudly instead of silently "sending" nothing;
 *  5. the rolling 24h cap stops a key-holder from burning the shared quota.
 *
 * No network: `globalThis.fetch` is stubbed for the whole file.
 */
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import { FakePrisma } from './helpers/fakePrisma.js';

process.env.NODE_ENV = 'test';

type EmailApi = typeof import('../src/services/email.service.js');
let emailService: EmailApi;
let env: typeof import('../src/config/env.js').env;

interface FetchCall {
  url: string;
  init: RequestInit;
  body: Record<string, any>;
}

const calls: FetchCall[] = [];
let nextResponse: { ok: boolean; status: number; body?: string } = { ok: true, status: 201 };

/** Env is a plain parsed object — tests flip provider flags directly. */
function setEnv(overrides: Record<string, unknown>): void {
  Object.assign(env as unknown as Record<string, unknown>, overrides);
}

before(async () => {
  emailService = await import('../src/services/email.service.js');
  env = (await import('../src/config/env.js')).env;
});

beforeEach(() => {
  calls.length = 0;
  nextResponse = { ok: true, status: 201 };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return {
      ok: nextResponse.ok,
      status: nextResponse.status,
      text: async () => nextResponse.body ?? '',
    } as unknown as Response;
  }) as unknown as typeof fetch;
});

afterEach(() => {
  setEnv({ EMAIL_PROVIDER: 'console', BREVO_API_KEY: '', RESEND_API_KEY: '' });
});

describe('parseFromAddress', () => {
  it('splits "Brand <addr>" and keeps a bare address usable', () => {
    assert.deepEqual(emailService.parseFromAddress('Apex Free Fire Club <no-reply@apex.com>'), {
      name: 'Apex Free Fire Club',
      email: 'no-reply@apex.com',
    });
    assert.deepEqual(emailService.parseFromAddress('  no-reply@apex.com '), {
      name: 'no-reply',
      email: 'no-reply@apex.com',
    });
  });
});

describe('console provider', () => {
  it('writes no network call — dev must not need credentials', async () => {
    setEnv({ EMAIL_PROVIDER: 'console' });
    await emailService.sendEmail({ to: 'a@b.com', subject: 's', text: 't' });
    assert.equal(calls.length, 0);
  });
});

describe('brevo provider', () => {
  it('posts the documented payload to the Brevo SMTP endpoint', async () => {
    setEnv({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'brevo-test-key',
      EMAIL_FROM: 'Thunder eSports <no-reply@thunder.in>',
    });

    await emailService.sendEmail({
      to: 'owner@example.com',
      subject: 'Sign-in code 123456',
      text: 'plain body',
      html: '<b>html body</b>',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['api-key'], 'brevo-test-key');
    assert.deepEqual(calls[0].body, {
      sender: { name: 'Thunder eSports', email: 'no-reply@thunder.in' },
      to: [{ email: 'owner@example.com' }],
      subject: 'Sign-in code 123456',
      textContent: 'plain body',
      htmlContent: '<b>html body</b>',
    });
  });

  it('throws on a non-2xx response so the caller can 502', async () => {
    setEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'brevo-test-key' });
    nextResponse = { ok: false, status: 401, body: '{"message":"Key not found"}' };

    await assert.rejects(
      () => emailService.sendEmail({ to: 'a@b.com', subject: 's 987654', text: 'code 987654' }),
      (error: Error) => {
        assert.match(error.message, /401/);
        // The OTP and the API key must never appear in an error we log.
        assert.ok(!error.message.includes('987654'), 'OTP leaked into the error message');
        assert.ok(!error.message.includes('brevo-test-key'), 'API key leaked into the error message');
        return true;
      },
    );
  });

  it('refuses to pretend it sent when the key is missing', async () => {
    setEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: '' });
    await assert.rejects(
      () => emailService.sendEmail({ to: 'a@b.com', subject: 's', text: 't' }),
      /BREVO_API_KEY is not set/,
    );
    assert.equal(calls.length, 0);
  });

  it('reports a network failure without leaking the body', async () => {
    setEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' });
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    await assert.rejects(
      () => emailService.sendEmail({ to: 'a@b.com', subject: 's 111222', text: '111222' }),
      (error: Error) => {
        assert.match(error.message, /network error/);
        assert.ok(!error.message.includes('111222'));
        return true;
      },
    );
  });
});

describe('resend provider', () => {
  it('posts to Resend with a bearer token and a combined from header', async () => {
    setEnv({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'resend-test-key',
      EMAIL_FROM: 'Thunder <no-reply@thunder.in>',
    });

    await emailService.sendEmail({ to: 'owner@example.com', subject: 's', text: 't' });

    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer resend-test-key');
    assert.equal(calls[0].body.from, 'Thunder <no-reply@thunder.in>');
    assert.deepEqual(calls[0].body.to, ['owner@example.com']);
  });
});

describe('smtp provider', () => {
  it('fails loudly instead of silently dropping the mail', async () => {
    setEnv({ EMAIL_PROVIDER: 'smtp' });
    await assert.rejects(
      () => emailService.sendEmail({ to: 'a@b.com', subject: 's', text: 't' }),
      /"smtp" is not implemented/,
    );
  });
});

describe('admin OTP template', () => {
  it('carries the code, the 10-minute expiry and a "you did not ask" warning', async () => {
    setEnv({ EMAIL_PROVIDER: 'console' });
    await emailService.sendAdminOtpEmail('owner@example.com', '424242', 'Apex FF');
    // console provider logs only; render the message through brevo to inspect it.
    setEnv({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' });
    await emailService.sendAdminOtpEmail('owner@example.com', '424242', 'Apex FF');

    const body = calls[0].body;
    assert.match(body.subject, /424242/);
    assert.match(body.subject, /Apex FF/);
    assert.match(body.textContent, /10 minutes/);
    assert.match(body.textContent, /used once/);
    assert.match(body.htmlContent, /424242/);
    assert.match(body.htmlContent, /rotate your access key/);
  });
});

// ─── rolling 24h cap (needs the Prisma fake) ──────────────────────────────

type AdminAuthApi = typeof import('../src/services/adminAuth.service.js');
let adminAuth: AdminAuthApi;
let fake: FakePrisma;
const tenantId = 'tenant-1';
const ownerEmail = 'deadesports99@gmail.com';

function buildFake(auditCount: number): FakePrisma {
  const now = Date.now();
  return new FakePrisma({
    tenants: [
      { id: tenantId, subdomain: 'apex-ff', brandName: 'Apex FF', isActive: true, allowEmailAuth: true },
    ],
    users: [
      {
        id: 'admin-1',
        tenantId,
        email: ownerEmail,
        role: 'ADMIN',
        isBanned: false,
        name: 'Owner',
        phoneNumber: '9000000001',
      },
    ],
    adminAuditLogs: Array.from({ length: auditCount }, (_, index) => ({
      id: `audit-${index}`,
      tenantId,
      action: 'ADMIN_OTP_REQUESTED',
      targetType: 'User',
      targetId: 'admin-1',
      createdAt: new Date(now - index * 60_000),
    })),
  });
}

describe('per-account daily OTP cap', () => {
  before(async () => {
    mock.module('../src/config/prisma.js', {
      namedExports: {
        prisma: new Proxy({} as never, {
          get: (_target, prop: string) => (fake as unknown as Record<string, unknown>)[prop],
        }),
        disconnectPrisma: async () => {},
      },
    });
    adminAuth = await import('../src/services/adminAuth.service.js');
  });

  it('allows a request while the account is under the cap', async () => {
    fake = buildFake(2);
    setEnv({ EMAIL_PROVIDER: 'console', ADMIN_OTP_DAILY_CAP: 10 });
    const result = await adminAuth.requestAdminOtp({ email: ownerEmail, tenantId });
    assert.equal(result.expiresInSeconds, 600);
  });

  it('blocks the request once the rolling 24h cap is reached', async () => {
    fake = buildFake(10);
    setEnv({ EMAIL_PROVIDER: 'console', ADMIN_OTP_DAILY_CAP: 10 });
    await assert.rejects(
      () => adminAuth.requestAdminOtp({ email: ownerEmail, tenantId }),
      (error: { statusCode?: number; message?: string }) => {
        assert.equal(error.statusCode, 429);
        assert.match(String(error.message), /Daily sign-in code limit/);
        return true;
      },
    );
  });
});
