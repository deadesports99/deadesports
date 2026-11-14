import type { NextFunction, Request, Response } from 'express';
import { mediaStorageService, MEDIA_PURPOSES } from '../services/mediaStorage.service.js';
import { sendResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Media upload controller (Phase 4).
 *
 * `POST /api/v1/media/upload?purpose=<tenant-logo|tournament-banner|match-screenshot>`
 * with the raw image bytes as the request body and an `image/*` content type.
 *
 * The client never sends a filename — the server derives the extension from the
 * bytes it actually received, so a `logo.png` that is really a PHP script is refused
 * by the magic-number check in the service.
 */
export async function uploadMedia(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new Error('Authenticated user missing');

    const purpose = typeof req.query.purpose === 'string' ? req.query.purpose : '';
    if (!purpose) {
      throw ApiError.badRequest(
        `A ?purpose= is required — one of: ${MEDIA_PURPOSES.join(', ')}`,
      );
    }

    if (!Buffer.isBuffer(req.body)) {
      throw ApiError.badRequest(
        'Send the image as the raw request body with Content-Type: image/png, image/jpeg or image/webp',
      );
    }

    const result = await mediaStorageService.upload({
      tenantId: req.user.tenantId,
      purpose,
      buffer: req.body,
    });

    sendResponse(res, 201, 'Image uploaded', result);
  } catch (err) {
    next(err);
  }
}

/** `GET /api/v1/media/config` — tells the admin UI whether to show the upload button. */
export async function getMediaConfig(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reason = mediaStorageService.disabledReason();
    sendResponse(res, 200, 'Media upload configuration', {
      enabled: reason === null,
      reason,
      maxBytes: mediaStorageService.maxBytes(),
      purposes: MEDIA_PURPOSES,
    });
  } catch (err) {
    next(err);
  }
}
