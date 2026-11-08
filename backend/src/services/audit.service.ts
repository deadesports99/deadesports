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
