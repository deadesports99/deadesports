import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { getFirebaseApp } from './firebase.service.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Firebase Storage media uploads (Phase 4 —
 * plan/firebase-migration/PHASE-4-FIREBASE-STORAGE.md).
 *
 * Tenant logos, tournament banners and match screenshots currently have to be typed
 * in as a URL by hand. This service accepts the bytes and returns a permanent public
 * URL, so the admin UI can offer a real "Upload" button.
 *
 * Design rules:
 *
 *  1. **Off by default.** `MEDIA_UPLOAD_ENABLED=false` → the route reports that
 *     uploads are unavailable. Nothing else in the API changes.
 *  2. **The bytes decide the type, not the header.** Each format has a magic-number
 *     check, so a renamed `.exe` can never be stored as `image/png`.
 *  3. **Tenant-scoped paths.** `media/{tenantId}/{purpose}/{uuid}.{ext}` — a tenant
 *     cannot overwrite or guess another tenant's object, and a future cleanup job can
 *     delete one tenant safely by prefix.
 *  4. **Paths and extensions are generated server-side.** The client's filename is
 *     never used to build the object path (no `../`, no polyglot extensions).
 *  5. **Stable URLs.** We mint a Firebase download token and store it in the object's
 *     metadata, so the returned URL never expires — a signed URL would silently break
 *     a logo a year later.
 *  6. **No new dependency.** The route takes a raw body with an `image/*` content
 *     type, so no multipart parser (multer & co.) is needed.
 */

export type MediaPurpose = 'tenant-logo' | 'tournament-banner' | 'match-screenshot';

export const MEDIA_PURPOSES: readonly MediaPurpose[] = [
  'tenant-logo',
  'tournament-banner',
  'match-screenshot',
];

export interface MediaUploadResult {
  url: string;
  /** Object path inside the bucket, e.g. `media/<tenantId>/tenant-logo/<uuid>.png`. */
  path: string;
  bucket: string;
  contentType: string;
  size: number;
  purpose: MediaPurpose;
}

/** Writes one object. Injectable so tests never touch the network. */
export type MediaWriter = (input: {
  path: string;
  buffer: Buffer;
  contentType: string;
  downloadToken: string;
}) => Promise<void>;

/** Detected image format, or null when the bytes are not an allowed image. */
export function detectImageType(buffer: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

const CONTENT_TYPE: Record<'png' | 'jpeg' | 'webp', string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXTENSION: Record<'png' | 'jpeg' | 'webp', string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

let bucketName: string | null = null;

/** Bucket resolution: explicit env wins, else the project's default bucket. */
export function resolveBucketName(): string {
  if (bucketName) return bucketName;
  const explicit = (env.FIREBASE_STORAGE_BUCKET ?? '').trim();
  bucketName = explicit || `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return bucketName;
}

/** Public, non-expiring Firebase download URL for an object. */
export function buildDownloadUrl(bucket: string, path: string, token: string): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(token)}`
  );
}

class MediaStorageService {
  private writer: MediaWriter | null = null;
  private injectedWriter: MediaWriter | null = null;

  public isEnabled(): boolean {
    return env.MEDIA_UPLOAD_ENABLED === 'true' && Boolean(env.FCM_CREDENTIALS_JSON);
  }

  /** Why uploads are unavailable — surfaced verbatim by the route. */
  public disabledReason(): string | null {
    if (env.MEDIA_UPLOAD_ENABLED !== 'true') return 'Media uploads are disabled on this server';
    if (!env.FCM_CREDENTIALS_JSON) {
      return 'Media uploads need a Firebase service account (FCM_CREDENTIALS_JSON)';
    }
    return null;
  }

  public maxBytes(): number {
    return env.MEDIA_MAX_UPLOAD_BYTES;
  }

  /**
   * Validate + store one image. Throws ApiError for anything the caller did wrong;
   * only real storage failures bubble up as 502-style errors.
   */
  public async upload(input: {
    tenantId: string;
    purpose: string;
    buffer: Buffer;
  }): Promise<MediaUploadResult> {
    const reason = this.disabledReason();
    if (reason) throw ApiError.forbidden(reason);

    const purpose = input.purpose as MediaPurpose;
    if (!MEDIA_PURPOSES.includes(purpose)) {
      throw ApiError.badRequest(
        `Unknown purpose "${input.purpose}" — use one of: ${MEDIA_PURPOSES.join(', ')}`,
      );
    }

    if (!Buffer.isBuffer(input.buffer) || input.buffer.length === 0) {
      throw ApiError.badRequest('No image bytes received — send the file as the request body');
    }

    const max = this.maxBytes();
    if (input.buffer.length > max) {
      throw ApiError.badRequest(
        `Image is ${(input.buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is ${(max / 1024 / 1024).toFixed(1)} MB`,
      );
    }

    const type = detectImageType(input.buffer);
    if (!type) {
      throw ApiError.badRequest('Only PNG, JPEG or WebP images are accepted');
    }

    const downloadToken = randomUUID();
    const path = `media/${input.tenantId}/${purpose}/${randomUUID()}.${EXTENSION[type]}`;
    const bucket = resolveBucketName();

    const writer = await this.resolveWriter();
    if (!writer) {
      throw ApiError.serviceUnavailable('Media storage is not reachable right now');
    }

    try {
      await writer({
        path,
        buffer: input.buffer,
        contentType: CONTENT_TYPE[type],
        downloadToken,
      });
    } catch (err) {
      console.error('[media] upload failed:', (err as Error).message);
      throw ApiError.serviceUnavailable('Upload failed — please retry in a moment');
    }

    return {
      url: buildDownloadUrl(bucket, path, downloadToken),
      path,
      bucket,
      contentType: CONTENT_TYPE[type],
      size: input.buffer.length,
      purpose,
    };
  }

  private async resolveWriter(): Promise<MediaWriter | null> {
    if (this.injectedWriter) return this.injectedWriter;
    if (this.writer) return this.writer;

    try {
      const app = getFirebaseApp();
      if (!app || !env.FCM_CREDENTIALS_JSON) return null;

      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage(app).bucket(resolveBucketName());

      this.writer = async ({ path, buffer, contentType, downloadToken }) => {
        const file = bucket.file(path);

        await file.save(buffer, { resumable: false, contentType });

        // Second call on purpose: `SaveOptions` in @google-cloud/storage has no
        // `metadata` field, so cache headers and the download token are set after
        // the object exists. The token is what makes the URL permanent instead of
        // a signed URL that would expire and break a live logo.
        await file.setMetadata({
          contentType,
          // Immutable objects: safe to cache for a year, which keeps egress cheap.
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { firebaseStorageDownloadTokens: downloadToken },
        });
      };
      return this.writer;
    } catch (err) {
      console.warn('[media] storage client unavailable:', (err as Error).message);
      return null;
    }
  }

  // ─── Test seams (not used in production paths) ─────────────────────────

  public setWriterForTesting(writer: MediaWriter | null): void {
    this.injectedWriter = writer;
  }

  public resetForTesting(): void {
    this.injectedWriter = null;
    this.writer = null;
    bucketName = null;
  }
}

export const mediaStorageService = new MediaStorageService();
