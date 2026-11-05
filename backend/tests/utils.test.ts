import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripTrailingSlashes } from '../src/utils/strings.js';
import { ApiError, isApiError } from '../src/utils/ApiError.js';

describe('stripTrailingSlashes', () => {
  it('removes every trailing slash', () => {
    assert.equal(stripTrailingSlashes('http://localhost:5000/'), 'http://localhost:5000');
    assert.equal(stripTrailingSlashes('http://localhost:5000///'), 'http://localhost:5000');
  });

  it('keeps strings without a trailing slash untouched', () => {
    assert.equal(stripTrailingSlashes('https://api.example.com/v1'), 'https://api.example.com/v1');
    assert.equal(stripTrailingSlashes(''), '');
    assert.equal(stripTrailingSlashes('/'), '');
    assert.equal(stripTrailingSlashes('////'), '');
  });

  it('never leaves a slash in the middle of the string', () => {
    assert.equal(stripTrailingSlashes('http://a/b/c/'), 'http://a/b/c');
  });
});

describe('ApiError', () => {
  it('carries status, message, details and the operational flag', () => {
    const details = { slotId: 's1' };
    const err = new ApiError(409, 'Slot already taken', details);
    assert.equal(err.statusCode, 409);
    assert.equal(err.message, 'Slot already taken');
    assert.deepEqual(err.details, details);
    assert.equal(err.isOperational, true);
    assert.equal(err.name, 'ApiError');
    assert.ok(err instanceof Error);
    assert.equal(new ApiError(500, 'boom', undefined, false).isOperational, false);
  });

  it('exposes helpers for the common status codes', () => {
    assert.equal(ApiError.badRequest('x').statusCode, 400);
    assert.equal(ApiError.unauthorized().statusCode, 401);
    assert.equal(ApiError.forbidden().statusCode, 403);
    assert.equal(ApiError.notFound().statusCode, 404);
    assert.equal(ApiError.internal().statusCode, 500);
  });

  it('isApiError only matches ApiError instances', () => {
    assert.equal(isApiError(new ApiError(400, 'bad')), true);
    assert.equal(isApiError(new Error('plain')), false);
    assert.equal(isApiError('nope'), false);
    assert.equal(isApiError(null), false);
  });
});
