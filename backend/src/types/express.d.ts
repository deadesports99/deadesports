import type { AuthUser } from './auth.js';

/**
 * Ambient (global) augmentation of Express.Request so that
 * `req.user` is available + typed inside every handler after
 * the `authenticate` middleware has run.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Raw request bytes, only populated for signature-verified webhooks. */
      rawBody?: Buffer;
    }
  }
}

// Re-exporting turns this file into a module so `declare global`
// actually augments the global scope. The import above is referenced
// by the interface, so it is not an unused import.
export type { AuthUser };