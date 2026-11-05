import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter, resetRateLimiters } from '../src/middlewares/rateLimiter.js';

interface Captured {
  status?: number;
  body?: { success: boolean; message: string; data?: Record<string, unknown> };
  headers: Record<string, string>;
}

function fakeRes() {
  const captured: Captured = { headers: {} };
  const res = {
    headersSent: false,
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return this;
    },
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload as Captured['body'];
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

const reqFor = (ip: string) => ({ ip, headers: {} }) as unknown as Request;

describe('createRateLimiter', () => {
  beforeEach(() => resetRateLimiters());

  it('lets requests through while under the limit and reports the remaining budget', () => {
    const limiter = createRateLimiter({ name: 't1', windowMs: 60_000, max: 2, key: (r) => String(r.ip) });
    let passed = 0;
    const next: NextFunction = () => { passed += 1; };

    const first = fakeRes();
    limiter(reqFor('1.1.1.1'), first.res, next);
    assert.equal(passed, 1);
    assert.equal(first.captured.headers['X-RateLimit-Limit'], '2');
    assert.equal(first.captured.headers['X-RateLimit-Remaining'], '1');

    const second = fakeRes();
    limiter(reqFor('1.1.1.1'), second.res, next);
    assert.equal(passed, 2);
    assert.equal(second.captured.headers['X-RateLimit-Remaining'], '0');
  });

  it('blocks the request over the limit with 429 + Retry-After', () => {
    const limiter = createRateLimiter({
      name: 't2',
      windowMs: 60_000,
      max: 1,
      key: (r) => String(r.ip),
      message: 'slow down please',
    });
    let passed = 0;
    const next: NextFunction = () => { passed += 1; };

    limiter(reqFor('2.2.2.2'), fakeRes().res, next);
    const blocked = fakeRes();
    limiter(reqFor('2.2.2.2'), blocked.res, next);

    assert.equal(passed, 1, 'second call must not reach the handler');
    assert.equal(blocked.captured.status, 429);
    assert.equal(blocked.captured.body?.message, 'slow down please');
    assert.equal(blocked.captured.body?.success, false);
    assert.equal(blocked.captured.headers['X-RateLimit-Remaining'], '0');
    assert.ok(Number(blocked.captured.headers['Retry-After']) >= 1);
    assert.equal(blocked.captured.body?.data?.max, 1);
  });

  it('keeps a separate budget per key', () => {
    const limiter = createRateLimiter({ name: 't3', windowMs: 60_000, max: 1, key: (r) => String(r.ip) });
    let passed = 0;
    const next: NextFunction = () => { passed += 1; };

    limiter(reqFor('3.3.3.3'), fakeRes().res, next);
    limiter(reqFor('4.4.4.4'), fakeRes().res, next);
    assert.equal(passed, 2, 'a different key must get its own bucket');
  });

  it('opens the window again after it slides past', () => {
    const limiter = createRateLimiter({ name: 't4', windowMs: 20, max: 1, key: (r) => String(r.ip) });
    let passed = 0;
    const next: NextFunction = () => { passed += 1; };
    limiter(reqFor('5.5.5.5'), fakeRes().res, next);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        limiter(reqFor('5.5.5.5'), fakeRes().res, next);
        assert.equal(passed, 2);
        resolve();
      }, 30);
    });
  });

  it('resetRateLimiters clears every bucket', () => {
    const limiter = createRateLimiter({ name: 't5', windowMs: 60_000, max: 1, key: (r) => String(r.ip) });
    let passed = 0;
    const next: NextFunction = () => { passed += 1; };
    limiter(reqFor('6.6.6.6'), fakeRes().res, next);
    resetRateLimiters();
    limiter(reqFor('6.6.6.6'), fakeRes().res, next);
    assert.equal(passed, 2);
  });
});
