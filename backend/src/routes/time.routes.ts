import { Router, type Request, type Response } from 'express';
import { prisma } from '../config/prisma.js';
import { sendResponse } from '../utils/ApiResponse.js';

export const timeRouter: Router = Router();

// Indian Standard Time offset: UTC + 5:30 (330 minutes = 19,800,000 ms)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getIstTimeInfo(date: Date = new Date()) {
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
  
  return {
    utc: date.toISOString(),
    ist: istDate.toISOString(),
    istFormatted: formatted,
    epochMs: date.getTime(),
    timezone: 'Asia/Kolkata',
    offsetMinutes: 330,
  };
}

/**
 * GET /api/v1/time
 * Returns authoritative Indian Standard Time directly verified by Supabase PostgreSQL.
 * Client devices MUST use this to prevent device clock spoofing.
 */
timeRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const dbTimeResult: any = await prisma.$queryRawUnsafe(`SELECT get_server_time() as time_info;`);
    const dbTime = dbTimeResult[0]?.time_info;

    res.setHeader('X-Server-Time', dbTime?.epoch_ms ? dbTime.epoch_ms.toString() : Date.now().toString());
    res.setHeader('X-Server-Time-IST', dbTime?.ist_formatted || getIstTimeInfo().istFormatted);

    return sendResponse(res, 200, 'Authoritative server time from Supabase', {
      serverTimeUtc: dbTime?.utc_now || new Date().toISOString(),
      serverTimeIst: dbTime?.ist_now || getIstTimeInfo().ist,
      istFormatted: dbTime?.ist_formatted || getIstTimeInfo().istFormatted,
      epochMs: dbTime?.epoch_ms ? Number(dbTime.epoch_ms) : Date.now(),
      timezone: 'Asia/Kolkata',
      offsetMinutes: 330,
      source: 'supabase_postgres',
    });
  } catch {
    const fallback = getIstTimeInfo();
    res.setHeader('X-Server-Time', fallback.epochMs.toString());
    res.setHeader('X-Server-Time-IST', fallback.istFormatted);

    return sendResponse(res, 200, 'Authoritative server time', {
      serverTimeUtc: fallback.utc,
      serverTimeIst: fallback.ist,
      istFormatted: fallback.istFormatted,
      epochMs: fallback.epochMs,
      timezone: 'Asia/Kolkata',
      offsetMinutes: 330,
      source: 'server_clock',
    });
  }
});
