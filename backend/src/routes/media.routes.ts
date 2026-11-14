import express, { type NextFunction, type Request, type Response, Router } from 'express';
import * as mediaController from '../controllers/media.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Media routes — mounted at /api/v1/media (Phase 4).
 *
 *  GET  /config   authenticated (ADMIN/SUB_ADMIN) -> is upload enabled, size limit
 *  POST /upload   authenticated (ADMIN/SUB_ADMIN) -> raw image body -> public URL
 *
 * Uploads are admin-only on purpose: players never need to push bytes to our bucket,
 * and keeping the surface that small means one permission to reason about.
 */
export const mediaRouter: Router = Router();

export const mediaUploadRateLimiter = createRateLimiter({
  name: 'media-upload',
  windowMs: 60_000,
  max: 10,
  key: (req) => req.user?.userId ?? req.ip ?? 'anonymous',
  message: 'Too many uploads — try again in a minute.',
});

/**
 * Parse the raw image body. Express' own parser raises a generic
 * `entity.too.large` / syntax error, which would surface as a 500 — map every parser
 * failure to a 400 with the actual limit so the admin UI can show it.
 */
const rawImageParser = express.raw({
  // Only these content types are buffered; anything else stays untouched.
  type: ['image/png', 'image/jpeg', 'image/webp'],
  limit: env.MEDIA_MAX_UPLOAD_BYTES,
});

function rawImageBody(req: Request, res: Response, next: NextFunction): void {
  rawImageParser(req, res, (err: unknown) => {
    if (err) {
      const limitMb = (env.MEDIA_MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(1);
      next(ApiError.badRequest(`Image upload failed — the limit is ${limitMb} MB per image`));
      return;
    }
    next();
  });
}

mediaRouter.get(
  '/config',
  authenticate,
  requireRole('ADMIN', 'SUB_ADMIN'),
  mediaController.getMediaConfig,
);

mediaRouter.post(
  '/upload',
  authenticate,
  requireRole('ADMIN', 'SUB_ADMIN'),
  mediaUploadRateLimiter,
  rawImageBody,
  mediaController.uploadMedia,
);
