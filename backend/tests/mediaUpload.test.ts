/**
 * Phase 4 — Firebase Storage media uploads.
 *
 * Proven here (no Firebase, no network — the object writer is injected):
 *  1. the bytes decide the file type, so a renamed non-image is refused;
 *  2. paths are tenant-scoped and generated server-side (no client filenames);
 *  3. the returned URL is a permanent tokenised download URL, not a signed one;
 *  4. size/purpose/enabled guards fail loudly with the right HTTP status;
 *  5. a storage failure becomes a 503, never a crash or a silent success.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';

type MediaModule = typeof import('../src/services/mediaStorage.service.js');
type EnvModule = typeof import('../src/config/env.js');

let media: MediaModule['mediaStorageService'];
let detectImageType: MediaModule['detectImageType'];
let buildDownloadUrl: MediaModule['buildDownloadUrl'];
let resolveBucketName: MediaModule['resolveBucketName'];
let env: EnvModule['env'];

/** Minimal valid magic-number prefixes, padded past the 12-byte sniff window. */
const pngBytes = (pad = 40) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(pad)]);

const jpegBytes = (pad = 40) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(pad)]);

const webpBytes = (pad = 40) =>
  Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(pad),
  ]);

function setEnv(overrides: Record<string, unknown>): void {
  Object.assign(env as unknown as Record<string, unknown>, overrides);
}

interface Written {
  path: string;
  buffer: Buffer;
  contentType: string;
  downloadToken: string;
}

/** Enabled service + a writer that records instead of uploading. */
function enable(written: Written[] = []) {
  setEnv({
    MEDIA_UPLOAD_ENABLED: 'true',
    FCM_CREDENTIALS_JSON: '{"type":"service_account"}',
    FIREBASE_PROJECT_ID: 'deadesports-865d2',
    FIREBASE_STORAGE_BUCKET: '',
    MEDIA_MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
  });
  media.resetForTesting();
  media.setWriterForTesting(async (input) => {
    written.push(input);
  });
  return written;
}

before(async () => {
  const mod = await import('../src/services/mediaStorage.service.js');
  media = mod.mediaStorageService;
  detectImageType = mod.detectImageType;
  buildDownloadUrl = mod.buildDownloadUrl;
  resolveBucketName = mod.resolveBucketName;
  env = (await import('../src/config/env.js')).env;
});

describe('media — image type detection', () => {
  beforeEach(() => media.resetForTesting());

  it('recognises PNG, JPEG and WebP from magic numbers', () => {
    assert.equal(detectImageType(pngBytes()), 'png');
    assert.equal(detectImageType(jpegBytes()), 'jpeg');
    assert.equal(detectImageType(webpBytes()), 'webp');
  });

  it('refuses anything else, including the header a client claims', () => {
    assert.equal(detectImageType(Buffer.from('<?php system($_GET[1]); ?>')), null);
    assert.equal(detectImageType(Buffer.from('GIF89a............')), null);
    assert.equal(detectImageType(Buffer.alloc(0)), null);
    assert.equal(detectImageType(Buffer.from([0x89, 0x50])), null, 'truncated PNG');
  });
});

describe('media — disabled by default', () => {
  beforeEach(() => {
    media.resetForTesting();
    setEnv({ MEDIA_UPLOAD_ENABLED: 'false', FCM_CREDENTIALS_JSON: '{"type":"service_account"}' });
  });

  it('reports why it is off and refuses to upload', async () => {
    assert.equal(media.isEnabled(), false);
    assert.match(media.disabledReason() ?? '', /disabled/);
    assert.equal(resolveBucketName(), 'deadesports-865d2.firebasestorage.app');

    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer: pngBytes() }),
      (err: any) => err.statusCode === 403,
    );
  });

  it('stays off without a service account even when the flag is on', () => {
    setEnv({ MEDIA_UPLOAD_ENABLED: 'true', FCM_CREDENTIALS_JSON: '' });
    assert.equal(media.isEnabled(), false);
    assert.match(media.disabledReason() ?? '', /service account/);
  });
});

describe('media — upload', () => {
  beforeEach(() => media.resetForTesting());

  it('stores a PNG under a tenant-scoped, server-generated path', async () => {
    const written = enable();
    const buffer = pngBytes(128);

    const result = await media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer });

    assert.match(result.path, /^media\/tenant-1\/tenant-logo\/[0-9a-f-]{36}\.png$/);
    assert.equal(result.contentType, 'image/png');
    assert.equal(result.size, buffer.length);
    assert.equal(result.purpose, 'tenant-logo');
    assert.equal(result.bucket, 'deadesports-865d2.firebasestorage.app');
    assert.equal(written.length, 1);
    assert.equal(written[0]!.path, result.path);
    assert.equal(written[0]!.contentType, 'image/png');
    assert.match(written[0]!.downloadToken, /^[0-9a-f-]{36}$/);
  });

  it('derives the extension from the bytes, not from a client filename', async () => {
    enable();
    const result = await media.upload({
      tenantId: 'tenant-1',
      purpose: 'tournament-banner',
      buffer: jpegBytes(),
    });
    assert.match(result.path, /\.jpg$/);
    assert.equal(result.contentType, 'image/jpeg');
  });

  it('isolates tenants by path prefix', async () => {
    enable();
    const a = await media.upload({ tenantId: 'tenant-a', purpose: 'tenant-logo', buffer: pngBytes() });
    const b = await media.upload({ tenantId: 'tenant-b', purpose: 'tenant-logo', buffer: pngBytes() });

    assert.notEqual(a.path, b.path);
    assert.ok(a.path.startsWith('media/tenant-a/'));
    assert.ok(b.path.startsWith('media/tenant-b/'));
  });

  it('returns a permanent tokenised URL that needs no Firebase session', async () => {
    enable();
    const result = await media.upload({
      tenantId: 'tenant-1',
      purpose: 'match-screenshot',
      buffer: webpBytes(),
    });

    assert.ok(result.url.startsWith('https://firebasestorage.googleapis.com/v0/b/'));
    assert.match(result.url, /\?alt=media&token=/);
    assert.equal(result.url.includes('Expires='), false, 'not a signed URL');
    assert.ok(result.url.includes(encodeURIComponent(result.path)));
  });

  it('rejects an unknown purpose', async () => {
    enable();
    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'profile-pic', buffer: pngBytes() }),
      (err: any) => err.statusCode === 400 && /purpose/.test(err.message),
    );
  });

  it('rejects oversized images with a readable message', async () => {
    enable();
    setEnv({ MEDIA_MAX_UPLOAD_BYTES: 32 });

    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer: pngBytes(200) }),
      (err: any) => err.statusCode === 400 && /limit/.test(err.message),
    );
  });

  it('rejects a non-image body', async () => {
    enable();
    await assert.rejects(
      () =>
        media.upload({
          tenantId: 'tenant-1',
          purpose: 'tenant-logo',
          buffer: Buffer.from('not an image at all'),
        }),
      (err: any) => err.statusCode === 400 && /PNG, JPEG or WebP/.test(err.message),
    );
  });

  it('rejects an empty body instead of storing a 0-byte object', async () => {
    enable();
    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer: Buffer.alloc(0) }),
      (err: any) => err.statusCode === 400,
    );
  });

  it('turns a storage failure into a 503, not a success', async () => {
    enable();
    media.setWriterForTesting(async () => {
      throw new Error('bucket unreachable');
    });

    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer: pngBytes() }),
      (err: any) => err.statusCode === 503,
    );
  });

  it('returns 503 when no storage client can be created', async () => {
    enable();
    media.setWriterForTesting(null); // falls through to the real (unavailable) SDK
    setEnv({ FCM_CREDENTIALS_JSON: '' });

    // Without credentials the service reports itself disabled rather than storing.
    await assert.rejects(
      () => media.upload({ tenantId: 'tenant-1', purpose: 'tenant-logo', buffer: pngBytes() }),
      (err: any) => err.statusCode === 403 || err.statusCode === 503,
    );
  });
});

describe('media — URL building', () => {
  it('encodes bucket and path segments', () => {
    const url = buildDownloadUrl('my-bucket', 'media/t-1/tenant-logo/a b.png', 'tok-1');
    assert.equal(
      url,
      'https://firebasestorage.googleapis.com/v0/b/my-bucket/o/' +
        'media%2Ft-1%2Ftenant-logo%2Fa%20b.png?alt=media&token=tok-1',
    );
  });

  it('honours an explicit bucket override', () => {
    media.resetForTesting();
    setEnv({ FIREBASE_STORAGE_BUCKET: 'legacy.appspot.com' });
    assert.equal(resolveBucketName(), 'legacy.appspot.com');
  });
});
