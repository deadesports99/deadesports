import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { Prisma } from '../generated/prisma/client.js';
import { isApiError } from '../utils/ApiError.js';
import { sendResponse } from '../utils/ApiResponse.js';

/** Prisma error code -> HTTP status mapping for the most common cases. */
const PRISMA_ERROR_STATUS: Record<string, { statusCode: number; message: string }> = {
  // Unique constraint violation (e.g. duplicate phone number, slot already booked).
  P2002: { statusCode: 409, message: 'Resource already exists — unique constraint violated' },
  // Foreign key constraint violation.
  P2003: { statusCode: 409, message: 'Related resource does not exist or is in use' },
  // Record not found.
  P2025: { statusCode: 404, message: 'Resource not found' },
  // Null constraint violation.
  P2011: { statusCode: 400, message: 'A required field is missing' },
  // Invalid value for a field.
  P2006: { statusCode: 400, message: 'Provided value is not valid for the field' },
  // Connection / query timeout.
  P1001: { statusCode: 503, message: 'Database unreachable — please retry' },
};

const isPrismaKnownError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

const isPrismaValidationError = (error: unknown): error is Prisma.PrismaClientValidationError =>
  error instanceof Prisma.PrismaClientValidationError;

/**
 * Global Express error handler — MUST be the last middleware in the pipeline.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // If headers were already sent, let Express handle the failure to avoid
  // corrupting the outgoing response.
  if (res.headersSent) {
    next(err);
    return;
  }

  // 1) Operational ApiErrors thrown by our own code.
  if (isApiError(err)) {
    sendResponse(res, err.statusCode, err.message, err.details);
    return;
  }

  // 2) Zod validation errors -> 400 with field-level details.
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    sendResponse(res, 400, 'Validation failed', details);
    return;
  }

  // 3) Prisma errors.
  if (isPrismaKnownError(err)) {
    const mapping = PRISMA_ERROR_STATUS[err.code];
    if (mapping) {
      sendResponse(res, mapping.statusCode, mapping.message, { prismaCode: err.code });
      return;
    }
    // Unknown Prisma error code — dos not leak the query, just the code.
    console.error(`[Prisma Unknown Error] code=${err.code}`, err.message);
    sendResponse(res, 500, 'Database operation failed', { prismaCode: err.code });
    return;
  }

  if (isPrismaValidationError(err)) {
    console.error('[Prisma Validation Error]', err.message);
    sendResponse(res, 400, 'Invalid database query');
    return;
  }

  // 4) JSON body parse errors from express.json().
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as SyntaxError & { status?: number }).status === 400
  ) {
    sendResponse(res, 400, 'Malformed JSON payload');
    return;
  }

  // 5) Anything else — unexpected crash. Hide internals in production.
  console.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err);
  const message =
    env.NODE_ENV === 'production' ? 'Internal Server Error' : (err as Error).message ?? 'Unknown error';
  const details = env.NODE_ENV === 'development' ? { stack: (err as Error).stack } : undefined;
  sendResponse(res, 500, message, details);
  return;
}