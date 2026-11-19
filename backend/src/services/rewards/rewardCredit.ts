import type { Prisma } from '../../generated/prisma/client.js';

/**
 * 💰 The only place reward money enters a wallet.
 *
 * Bonuses are NON-WITHDRAWABLE play money: they always land in the DEPOSIT
 * balance (entry fees can use it, /withdraw only sees winnings). One ledger row
 * per credit with `referenceId` = the claim row, so a bad batch is reversible by
 * finding every ledger row that points at it.
 *
 * Must be called inside a transaction: the caller owns the idempotency check
 * (unique key / conditional update) so this helper never has to guess.
 */
export interface CreditRewardInput {
  tenantId: string;
  userId: string;
  amount: number;
  category: 'DAILY_BONUS' | 'TASK_REWARD' | 'REFERRAL_BONUS';
  referenceId: string;
  notes: string;
}

export interface CreditResult {
  amount: number;
  depositBalance: number;
  winningBalance: number;
}

export async function creditReward(
  tx: Prisma.TransactionClient,
  input: CreditRewardInput,
): Promise<CreditResult> {
  const amount = Math.round(input.amount * 100) / 100;
  if (amount <= 0) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { depositBalance: true, winningBalance: true },
    });
    return {
      amount: 0,
      depositBalance: Number(user.depositBalance),
      winningBalance: Number(user.winningBalance),
    };
  }

  const updated = await tx.user.update({
    where: { id: input.userId },
    data: { depositBalance: { increment: amount } },
    select: { depositBalance: true, winningBalance: true },
  });

  await tx.walletLedger.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      amount,
      balanceType: 'DEPOSIT',
      type: 'CREDIT',
      category: input.category,
      balanceAfter: updated.depositBalance,
      referenceId: input.referenceId,
      notes: input.notes,
    },
  });

  return {
    amount,
    depositBalance: Number(updated.depositBalance),
    winningBalance: Number(updated.winningBalance),
  };
}
