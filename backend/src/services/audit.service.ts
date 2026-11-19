import { prisma } from '../config/prisma.js';

/**
 * Append-only admin audit trail. Every sensitive action (login, key issue /
 * revoke, money approval, payout, ban) writes one row here.
 *
 * Audit failures must never break the action itself, so errors are swallowed
 * after a single warning line.
 */

export interface AuditInput {
  tenantId: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        meta: (input.meta ?? undefined) as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.warn('⚠️ audit log write failed:', (error as Error).message);
  }
}

export interface AuditRow {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * Owner console feed: newest first, optionally filtered by action.
 *
 * The trail was write-only before this — incidents could be logged but never
 * read from the product, which made the "who approved this payout?" question
 * unanswerable in practice.
 */
export async function listAuditLogs(
  tenantId: string,
  options: { limit?: number; action?: string } = {},
): Promise<AuditRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 200);
  const rows = await prisma.adminAuditLog.findMany({
    where: { tenantId, ...(options.action ? { action: options.action } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const actorIds = [...new Set(rows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(actors.map((actor) => [actor.id, actor.name ?? actor.email ?? null]));

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorRole: row.actorRole,
    actorName: row.actorId ? nameById.get(row.actorId) ?? null : null,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    meta: (row.meta ?? null) as Record<string, unknown> | null,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  }));
}
