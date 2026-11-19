import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { creditReward } from './rewardCredit.js';
import { getRewardConfig } from './rewardConfig.service.js';
import { isUniqueViolation, pushWallet } from './dailyBonus.service.js';

/**
 * 🤝 REFERRAL — "dost ko bulao": ₹40 referrer, ₹20 dost.
 *
 * Lifecycle of one invitation:
 *   PENDING   → friend applied your code (money exists nowhere yet)
 *   QUALIFIED → friend played the required paid match(es)
 *   PAID      → both wallets credited, one ledger row each
 *
 * The pair is unique (`@@unique([referrerId, refereeId])`), so a friend can be
 * counted exactly once no matter how many times the code is pasted.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomCode(length = 7): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function generateUniqueCode(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const clash = await prisma.referralProfile.findFirst({
      where: { tenantId, code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // Practically unreachable (32^7 space); a timestamp keeps the account usable.
  return `R${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Lazily creates the player's referral profile on first read. */
export async function getOrCreateProfile(tenantId: string, userId: string) {
  const existing = await prisma.referralProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = await generateUniqueCode(tenantId);
    try {
      return await prisma.referralProfile.create({ data: { tenantId, userId, code } });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Same user created concurrently → read it back.
      const again = await prisma.referralProfile.findUnique({ where: { userId } });
      if (again) return again;
    }
  }
  throw ApiError.conflict('Referral code generate nahi hua — dobara try karo');
}

export interface ReferralInvitee {
  ign: string | null;
  status: string;
  joinedAt: Date;
  qualifiedAt: Date | null;
}

export interface ReferralInfo {
  code: string;
  shareText: string;
  invited: number;
  qualified: number;
  paid: number;
  earned: number;
  pendingCount: number;
  rewardPerFriend: number;
  friendReward: number;
  minMatches: number;
  applied: boolean;
  invitees: ReferralInvitee[];
}

export async function getReferralInfo(tenantId: string, userId: string): Promise<ReferralInfo> {
  const [profile, cfg] = await Promise.all([
    getOrCreateProfile(tenantId, userId),
    getRewardConfig(tenantId),
  ]);

  const earnings = await prisma.referralEarning.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const refereeIds = earnings.map((row) => row.refereeId);
  const referees = refereeIds.length
    ? await prisma.user.findMany({
        where: { id: { in: refereeIds } },
        select: { id: true, inGameName: true },
      })
    : [];
  const ignById = new Map(referees.map((row) => [row.id, row.inGameName]));

  const paid = earnings.filter((row) => row.status === 'PAID');
  // Privacy: an invited friend's name only appears once they actually qualified.
  const invitees: ReferralInvitee[] = earnings.map((row) => ({
    ign: row.status === 'PENDING' ? null : (ignById.get(row.refereeId) ?? null),
    status: row.status,
    joinedAt: row.createdAt,
    qualifiedAt: row.qualifiedAt,
  }));

  return {
    code: profile.code,
    shareText:
      `Spartan Arena pe Free Fire tournaments khelo — mera code ${profile.code} use karo ` +
      `aur ₹${cfg.referral.friendReward} bonus pao.`,
    invited: earnings.length,
    qualified: earnings.filter((row) => row.status === 'QUALIFIED' || row.status === 'PAID').length,
    paid: paid.length,
    earned: paid.reduce((sum, row) => sum + Number(row.amount), 0),
    pendingCount: earnings.filter((row) => row.status === 'PENDING').length,
    rewardPerFriend: cfg.referral.rewardPerFriend,
    friendReward: cfg.referral.friendReward,
    minMatches: cfg.referral.minMatches,
    applied: Boolean(profile.referredById),
    invitees,
  };
}

export async function applyReferralCode(
  tenantId: string,
  userId: string,
  rawCode: string,
): Promise<ReferralInfo> {
  const code = rawCode.trim().toUpperCase();
  if (!code) throw ApiError.badRequest('Referral code daalo');

  const [cfg, me] = await Promise.all([
    getRewardConfig(tenantId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true, deviceId: true, createdAt: true },
    }),
  ]);
  if (!me) throw ApiError.notFound('Player not found');
  if (me.isBanned) throw ApiError.forbidden('Account is blocked');

  const profile = await getOrCreateProfile(tenantId, userId);
  if (profile.code === code) throw ApiError.badRequest('Apna hi code use nahi kar sakte');
  if (profile.referredById) throw ApiError.conflict('Referral code already applied');

  const inviter = await prisma.referralProfile.findFirst({ where: { tenantId, code } });
  if (!inviter) throw ApiError.notFound('Referral code galat hai');
  if (inviter.userId === userId) throw ApiError.badRequest('Apna hi code use nahi kar sakte');

  const inviterUser = await prisma.user.findUnique({
    where: { id: inviter.userId },
    select: { id: true, isBanned: true, deviceId: true },
  });
  if (!inviterUser) throw ApiError.notFound('Referral code galat hai');
  if (inviterUser.isBanned) throw ApiError.forbidden('Ye referral code ab valid nahi hai');

  // Same-handset farming is the cheapest abuse to block.
  if (me.deviceId && inviterUser.deviceId && me.deviceId === inviterUser.deviceId) {
    throw ApiError.forbidden('Ek hi device se referral allowed nahi hai');
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  if (cfg.referral.maxPerDay > 0) {
    const todayCount = await prisma.referralEarning.count({
      where: { referrerId: inviter.userId, createdAt: { gte: dayStart } },
    });
    if (todayCount >= cfg.referral.maxPerDay) {
      throw ApiError.forbidden('Aaj ka referral limit poora ho gaya — kal try karo');
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.referralProfile.update({
      where: { userId },
      data: { referredById: inviter.userId, referredAt: new Date() },
    });
    try {
      await tx.referralEarning.create({
        data: {
          tenantId,
          referrerId: inviter.userId,
          refereeId: userId,
          amount: cfg.referral.rewardPerFriend,
          friendAmount: cfg.referral.friendReward,
          status: 'PENDING',
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict('Referral already applied');
      throw err;
    }
  });

  return getReferralInfo(tenantId, userId);
}

export interface QualifyResult {
  qualified: boolean;
  referrerCredited: number;
  friendCredited: number;
}

/**
 * Called after a match is settled/payed for `userId`. Promotes a PENDING referral
 * to PAID as soon as the referee has played the required number of paid matches,
 * crediting both sides exactly once.
 */
export async function qualifyReferralForPlayer(
  tenantId: string,
  userId: string,
  tournamentId?: string,
): Promise<QualifyResult> {
  const profile = await prisma.referralProfile.findUnique({ where: { userId } });
  if (!profile?.referredById) return { qualified: false, referrerCredited: 0, friendCredited: 0 };

  const earning = await prisma.referralEarning.findFirst({
    where: { referrerId: profile.referredById, refereeId: userId, status: 'PENDING' },
  });
  if (!earning) return { qualified: false, referrerCredited: 0, friendCredited: 0 };

  const cfg = await getRewardConfig(tenantId);
  const played = await prisma.matchResult.count({ where: { userId } });
  if (played < cfg.referral.minMatches) {
    return { qualified: false, referrerCredited: 0, friendCredited: 0 };
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.referralEarning.updateMany({
      where: { id: earning.id, status: 'PENDING' },
      data: { status: 'PAID', qualifiedAt: new Date(), paidAt: new Date(), tournamentId: tournamentId ?? null },
    });
    if (claimed.count !== 1) {
      return { qualified: false, referrerCredited: 0, friendCredited: 0 };
    }

    const referrer = await creditReward(tx, {
      tenantId,
      userId: earning.referrerId,
      amount: Number(earning.amount),
      category: 'REFERRAL_BONUS',
      referenceId: `${earning.id}:referrer`,
      notes: 'Referral reward — friend qualified',
    });
    const friend = await creditReward(tx, {
      tenantId,
      userId,
      amount: Number(earning.friendAmount),
      category: 'REFERRAL_BONUS',
      referenceId: `${earning.id}:friend`,
      notes: 'Referral welcome bonus',
    });

    pushWallet(earning.referrerId, referrer.depositBalance, referrer.winningBalance, 'REFERRAL_BONUS', referrer.amount);
    pushWallet(userId, friend.depositBalance, friend.winningBalance, 'REFERRAL_BONUS', friend.amount);

    return {
      qualified: true,
      referrerCredited: referrer.amount,
      friendCredited: friend.amount,
    };
  });
}
