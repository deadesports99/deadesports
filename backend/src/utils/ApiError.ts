/**
 * ApiError — Standardized operational error for the platform.
 *
 * Every error thrown by controllers/services/middlewares should be an
 * ApiError (or extend it) so the global error handler can respond with a
 * consistent JSON payload and correct HTTP status code.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown, isOperational: boolean = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Keep the stack trace clean (exclude this constructor frame).
    Error.captureStackTrace(this, this.constructor);
  }

  /** 400 Bad Request — invalid input, validation failure, malformed payload. */
  public static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  /** 401 Unauthorized — missing/invalid authentication credentials. */
  public static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  /** 403 Forbidden — authenticated but not permitted to perform the action. */
  public static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  /** 404 Not Found — requested resource/route does not exist. */
  public static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  /** 409 Conflict — state conflict, e.g. unique constraint, slot already booked. */
  public static conflict(message: string = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, message, details);
  }

  /** 500 Internal Server Error — unexpected failure (non-operational). */
  public static internal(message: string = 'Internal Server Error'): ApiError {
    return new ApiError(500, message, undefined, false);
  }
}

/** Type guard utility: is this thrown value an ApiError? */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}