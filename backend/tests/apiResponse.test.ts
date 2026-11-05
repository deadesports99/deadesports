import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sendResponse } from '../src/utils/ApiResponse.js';

function fakeRes() {
  const captured: { status?: number; body?: unknown } = {};
  return {
    captured,
    res: {
      status(code: number) {
        captured.status = code;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload;
        return this;
      },
    } as unknown as import('express').Response,
  };
}

describe('sendResponse', () => {
  it('wraps 2xx responses in a success envelope', () => {
    const { res, captured } = fakeRes();
    sendResponse(res, 201, 'Created', { id: '1' });
    assert.equal(captured.status, 201);
    assert.deepEqual(captured.body, {
      success: true,
      message: 'Created',
      data: { id: '1' },
      statusCode: 201,
    });
  });

  it('marks non-2xx responses as failures', () => {
    const { res, captured } = fakeRes();
    sendResponse(res, 404, 'Not found');
    assert.equal(captured.status, 404);
    assert.deepEqual(captured.body, {
      success: false,
      message: 'Not found',
      data: undefined,
      statusCode: 404,
    });
  });
});
