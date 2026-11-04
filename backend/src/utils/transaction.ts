import { Prisma } from '../generated/prisma/client.js';

/**
 * Retry a Serializable transaction when Postgres aborts it with P2034
 * ("Transaction write conflict / could not serialize access due to
 * concurrent update").
 *
 * Why this exists: Postgres's Serializable Snapshot Isolation (SSI) can
 * abort a transaction even when the rows it touches are disjoint — a known
 * false-positive under concurrent load (e.g. 48 players joining, or the
 * admin approving 48 deposits in one batch). Because the aborted
 * transaction rolled back and committed NOTHING, retrying the exact same
 * work is always safe and idempotent (the conditional guards — status flips,
 * unique constraints, balance >= fee checks — still hold on every attempt).
 *
 * @param fn       The interactive prisma.$transaction(...) callback.
 * @param retries  Max retry attempts after the first P2034 abort.
 * @param baseDelayMs  Backoff base (delay = baseDelayMs * attempt).
 */
export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 40,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const isWriteConflict =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034';
      if (!isWriteConflict || attempt >= retries) throw err;
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
}
