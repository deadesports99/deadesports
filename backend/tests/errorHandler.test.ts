import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError, z } from 'zod';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { ApiError } from '../src/utils/ApiError.js';

interface Captured { status?: number; body?: any }

function fakeRes(headersSent = false) {
  const captured: Captured = {};
  const res = {
    headersSent,
    status(code: number) { captured.status = code; return this; },
    json(payload: unknown) { captured.body = payload; return this; },
  } as unknown as Response;
  return { res, captured };
}

const req = { method: 'GET', originalUrl: '/api/v1/thing' } as unknown as Request;
const noop: NextFunction = () => {};

function run(err: unknown, headersSent = false) {
  const { res, captured } = fakeRes(headersSent);
  errorHandler(err, req, res, noop);
  return captured;
}

describe('errorHandler', () => {
  it('maps ApiError to its own status and message', () => {
    const out = run(ApiError.notFound('Tournament not found'));
    assert.equal(out.status, 404);
    assert.equal(out.body.message, 'Tournament not found');
    assert.equal(out.body.success, false);
  });

  it('maps ZodError to 400 with field details', () => {
    const schema = z.object({ amount: z.number().min(10) });
    const parsed = schema.safeParse({ amount: 5 });
    assert.equal(parsed.success, false);
    const out = run(parsed.error as ZodError);
    assert.equal(out.status, 400);
    assert.equal(out.body.message, 'Validation failed');
    assert.deepEqual(out.body.data, [{ field: 'amount', message: 'Too small: expected number to be >=10' }]);
  });

  it('maps a malformed JSON body error to 400', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });
    const out = run(err);
    assert.equal(out.status, 400);
    assert.equal(out.body.message, 'Malformed JSON payload');
  });

  it('hides internals for unexpected errors but keeps the message in dev', () => {
    const out = run(new Error('kaboom'));
    assert.equal(out.status, 500);
    assert.equal(out.body.message, 'kaboom');
  });

  it('delegates to next when headers were already sent', () => {
    let calledWith: unknown;
    const { res } = fakeRes(true);
    errorHandler(new Error('late'), req, res, ((e: unknown) => { calledWith = e; }) as NextFunction);
    assert.ok(calledWith instanceof Error);
  });
});
