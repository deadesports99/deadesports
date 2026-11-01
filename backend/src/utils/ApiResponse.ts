import type { Response } from 'express';

/**
 * Standard envelope for every JSON response the API returns.
 *
 * @example
 * sendResponse(res, 200, 'User fetched', { id: '...' });
 * // => { success: true, message: 'User fetched', data: {...}, statusCode: 200 }
 */
export interface ApiResponseData<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  statusCode: number;
}

/**
 * Send a standardized JSON response.
 */
export function sendResponse<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
): Response {
  const body: ApiResponseData<T> = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    statusCode,
  };
  return res.status(statusCode).json(body);
}