import { csvEscape } from '../utils/csv.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { invalidateAuthCache } from '../middlewares/auth.middleware.js';
import { AuthUser } from '../types/auth.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * 🧑‍🤝‍🧑 ADMIN MATCH ROSTER — "who is in this match, what do they get, who cheats"
 *
 * One screen serves three jobs the owner needs after a match:
 *   1. LOOK UP   — every participant with their join-time IGN / FF UID / phone
 *                  (snapshot first, live profile as fallback) + server-side search.
 *   2. REWARD    — pay rank/kill prizes to specific players in one transaction.
 *   3. BAN       — match-scoped ban (this match only) or account ban (all matches).
 *
 * Cheat signals are computed server-side so the app never has to guess:
 *   NO_FF_UID        no Free Fire UID on record  -> cannot be paid by UID
 *   UID_MISMATCH     joined with a different UID than the current profile
 *   SAME_DEVICE      two+ accounts from one device inside THIS match
 *   SAME_DEVICE_CROSS the same device also joined OTHER matches (farm pattern)
 *   ACCOUNT_BANNED   account-wide ban already active
 *   DISQUALIFIED     match result flagged by the scorer
 */

/** Rank prize share of the pool — mirrors `result.service.ts` (single source of truth). */
const RANK_PRIZE_SHARE: Record<number, number> = { 1: 0.5, 2: 0.3, 3: 0.2 };

export type ParticipantFlagCode =
  | 'NO_FF_UID'
  | 'UID_MISMATCH'
  | 'SAME_DEVICE'
  | 'SAME_DEVICE_CROSS'
  | 'ACCOUNT_BANNED'
  | 'DISQUALIFIED';

export interface ParticipantFlag {
  code: ParticipantFlagCode;
  detail: string;
}

export interface RosterParticipant {
  slotId: string;
  slotNumber: number;
  teamId: string | null;
  userId: string;
  playerCode: string | null;
  name: string | null;
  inGameName: string | null;
  inGameUid: string | null;
  phoneNumber: string;
  joinedAt: string;
  /** Match-scoped ban (only this match). */
  isBanned: boolean;
  banReason: string | null;
  /** Account-wide ban (`User.isBanned`). */
  accountBanned: boolean;
  result: {
    rank: number | null;
    verifiedKills: number;
    prizeWon: string;
    isApproved: boolean;
    isDisqualified: boolean;
    disqualifyReason: string | null;
  } | null;
  flags: ParticipantFlag[];
}

export interface RosterResponse {
  match: {
    id: string;
    matchNumber: number | null;
    title: string;
    mapType: string;
    matchType: string;
    status: string;
    matchTime: string;
    entryFee: string;
    prizePool: string;
    perKillPrize: string;
    totalSlots: number;
    slotsBooked: number;
  };
  prizeRules: { '1': number; '2': number; '3': number };
  participants: RosterParticipant[];
  summary: {
    total: number;
    flagged: number;
    noUid: number;
    banned: number;
    paid: number;
    totalEntryCollected: string;
    totalPrizePaid: string;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Rank + kill prize for one player (same maths the payout engine uses). */
export function computePrize(
  pool: number,
  perKill: number,
  rank: number | null,
  kills: number,
): number {
  const rankPrize = rank ? round2((RANK_PRIZE_SHARE[rank] ?? 0) * pool) : 0;
  const killPrize = round2(Math.max(0, kills) * perKill);
  return round2(rankPrize + killPrize);
}

async function findMatchOrThrow(tenantId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tenantId },
  });
  if (!tournament) throw ApiError.notFound('Match not found');
  return tournament;
}

/**
 * Full participant roster for one match, optionally narrowed by `search`
 * (Player ID / IGN / FF UID / phone / slot number) and `flagsOnly`.
 * Search runs in SQL so a full house stays one small response.
 */
export async function getMatchRoster(
  staff: AuthUser,
  tournamentId: string,
  search?: string,
  flagsOnly?: 'flagged' | 'noUid' | 'banned' | 'unpaid',
): Promise<RosterResponse> {
  const tournament = await findMatchOrThrow(staff.tenantId, tournamentId);
  const q = (search ?? '').trim();

  const where: Prisma.TournamentSlotWhereInput = { tournamentId };
  if (q) {
    // Slot numbers are 1..N; only treat the query as a slot when it fits an
    // Int32 (a 10-digit phone number must never reach the integer column).
    const asSlot = Number(q);
    const isSlotQuery =
      q.length <= 6 && Number.isInteger(asSlot) && asSlot > 0 && asSlot <= 999;
    where.OR = [
      ...(isSlotQuery ? [{ slotNumber: asSlot }] : []),
      { inGameNameSnapshot: { contains: q, mode: 'insensitive' as const } },
      { inGameUidSnapshot: { contains: q } },
      { user: { playerCode: { contains: q, mode: 'insensitive' as const } } },
      { user: { inGameName: { contains: q, mode: 'insensitive' as const } } },
      { user: { inGameUid: { contains: q } } },
      { user: { phoneNumber: { contains: q } } },
      { user: { name: { contains: q, mode: 'insensitive' as const } } },
    ];
  }
  if (flagsOnly === 'banned') where.isBanned = true;

  const slots = await prisma.tournamentSlot.findMany({
    where,
    orderBy: { slotNumber: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          playerCode: true,
          name: true,
          phoneNumber: true,
          inGameName: true,
          inGameUid: true,
          deviceId: true,
          isBanned: true,
          matchResults: {
            where: { tournamentId },
            select: {
              rank: true,
              verifiedKills: true,
              prizeWon: true,
              isApproved: true,
              isDisqualified: true,
              disqualifyReason: true,
            },
          },
        },
      },
    },
  });

  // ── Device clusters: same device inside THIS match + across other matches ──
  const devices = [
    ...new Set(
      slots
        .map((s) => s.deviceIdSnapshot)
        .filter((d): d is string => Boolean(d && d.trim())),
    ),
  ];
  const inMatchDeviceCount = new Map<string, number>();
  for (const slot of slots) {
    const d = slot.deviceIdSnapshot;
    if (d) inMatchDeviceCount.set(d, (inMatchDeviceCount.get(d) ?? 0) + 1);
  }

  // How many *other* matches each of these devices also joined (farm signal).
  const crossDeviceCount = new Map<string, number>();
  if (devices.length > 0) {
    const rows = await prisma.tournamentSlot.groupBy({
      by: ['deviceIdSnapshot'],
      where: { deviceIdSnapshot: { in: devices }, tournamentId: { not: tournamentId } },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (row.deviceIdSnapshot) {
        crossDeviceCount.set(row.deviceIdSnapshot, row._count._all);
      }
    }
  }

  const participants: RosterParticipant[] = slots.map((slot) => {
    const user = slot.user;
    const inGameName = slot.inGameNameSnapshot ?? user.inGameName ?? null;
    const inGameUid = slot.inGameUidSnapshot ?? user.inGameUid ?? null;
    const device = slot.deviceIdSnapshot ?? user.deviceId ?? null;
    const result = user.matchResults[0] ?? null;

    const flags: ParticipantFlag[] = [];
    if (!inGameUid) {
      flags.push({ code: 'NO_FF_UID', detail: 'No Free Fire UID — cannot be paid by UID' });
    }
    if (
      slot.inGameUidSnapshot &&
      user.inGameUid &&
      slot.inGameUidSnapshot !== user.inGameUid
    ) {
      flags.push({
        code: 'UID_MISMATCH',
        detail:
          `Joined with UID ${slot.inGameUidSnapshot}, profile now ${user.inGameUid} ` +
          '— the player edited their UID after joining (check before disqualifying)',
      });
    }
    const sameDevice = device ? (inMatchDeviceCount.get(device) ?? 0) : 0;
    if (device && sameDevice > 1) {
      flags.push({
        code: 'SAME_DEVICE',
        detail: `${sameDevice} accounts from this device in this match`,
      });
    }
    const cross = device ? (crossDeviceCount.get(device) ?? 0) : 0;
    if (device && cross > 0) {
      flags.push({
        code: 'SAME_DEVICE_CROSS',
        detail: `This device also holds ${cross} seat(s) in other matches`,
      });
    }
    if (user.isBanned) {
      flags.push({ code: 'ACCOUNT_BANNED', detail: 'Account is banned' });
    }
    if (result?.isDisqualified) {
      flags.push({
        code: 'DISQUALIFIED',
        detail: result.disqualifyReason || 'Disqualified by scorer',
      });
    }

    return {
      slotId: slot.id,
      slotNumber: slot.slotNumber,
      teamId: slot.teamId,
      userId: slot.userId,
      playerCode: user.playerCode,
      name: user.name,
      inGameName,
      inGameUid,
      phoneNumber: user.phoneNumber,
      joinedAt: slot.joinedAt.toISOString(),
      isBanned: slot.isBanned,
      banReason: slot.banReason,
      accountBanned: user.isBanned,
      result: result
        ? {
            rank: result.rank,
            verifiedKills: result.verifiedKills,
            prizeWon: String(result.prizeWon),
            isApproved: result.isApproved,
            isDisqualified: result.isDisqualified,
            disqualifyReason: result.disqualifyReason,
          }
        : null,
      flags,
    };
  });

  const filtered = participants.filter((p) => {
    if (flagsOnly === 'flagged') return p.flags.length > 0;
    if (flagsOnly === 'noUid') return !p.inGameUid;
    if (flagsOnly === 'banned') return p.isBanned || p.accountBanned;
    if (flagsOnly === 'unpaid') return !p.result?.isApproved;
    return true;
  });

  const entryFee = Number(tournament.entryFee);
  const totalPaid = participants.reduce(
    (sum, p) => sum + (p.result?.isApproved ? Number(p.result.prizeWon) : 0),
    0,
  );

  return {
    match: {
      id: tournament.id,
      matchNumber: tournament.matchNumber,
      title: tournament.title,
      mapType: tournament.mapType,
      matchType: tournament.matchType,
      status: tournament.status,
      matchTime: tournament.matchTime.toISOString(),
      entryFee: String(tournament.entryFee),
      prizePool: String(tournament.prizePool),
      perKillPrize: String(tournament.perKillPrize),
      totalSlots: tournament.totalSlots,
      slotsBooked: await prisma.tournamentSlot.count({ where: { tournamentId } }),
    },
    prizeRules: {
      '1': RANK_PRIZE_SHARE[1]!,
      '2': RANK_PRIZE_SHARE[2]!,
      '3': RANK_PRIZE_SHARE[3]!,
    },
    participants: filtered,
    summary: {
      total: filtered.length,
      flagged: filtered.filter((p) => p.flags.length > 0).length,
      noUid: filtered.filter((p) => !p.inGameUid).length,
      banned: filtered.filter((p) => p.isBanned || p.accountBanned).length,
      paid: filtered.filter((p) => p.result?.isApproved).length,
      totalEntryCollected: String(round2(entryFee * participants.length)),
      totalPrizePaid: String(round2(totalPaid)),
    },
  };
}

export interface AwardInput {
  userId: string;
  rank?: number | null;
  kills?: number;
  /** Explicit amount; when omitted the server computes the rank+kill prize. */
  amount?: number;
  isDisqualified?: boolean;
  disqualifyReason?: string;
  note?: string;
}

export interface PayoutAwardsResult {
  tournamentId: string;
  status: string;
  totalPaid: number;
  playersPaid: number;
  skipped: Array<{ userId: string; reason: string }>;
  breakdown: Array<{
    userId: string;
    inGameUid: string | null;
    rank: number | null;
    verifiedKills: number;
    prizePaid: number;
    isDisqualified: boolean;
  }>;
}

const PAYOUT_STATUSES = ['OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'LIVE', 'UNDER_REVIEW'] as const;

/**
 * Pay specific players of a match. Safeguards (all enforced inside one
 * Serializable transaction on the locked match row):
 *   - every award must belong to a booked participant of THIS match
 *   - match-banned / account-banned players can never be paid
 *   - an already approved result is never paid twice (idempotent retry)
 *   - the sum of all approved prizes can never exceed the match prize pool
 */
export async function payoutMatchAwards(
  staff: AuthUser,
  tournamentId: string,
  awards: AwardInput[],
  completeMatch: boolean,
): Promise<PayoutAwardsResult> {
  const tournament = await findMatchOrThrow(staff.tenantId, tournamentId);
  if (tournament.status === 'CANCELLED') {
    throw ApiError.conflict('This match was cancelled — nothing to pay');
  }
  if (!(PAYOUT_STATUSES as readonly string[]).includes(tournament.status)) {
    throw ApiError.conflict(`Payout not allowed while the match is ${tournament.status}`);
  }
  if (awards.length === 0) throw ApiError.badRequest('At least one award is required');
  if (awards.length > 60) throw ApiError.badRequest('Too many awards in one request');

  const pool = Number(tournament.prizePool);
  const perKill = Number(tournament.perKillPrize);

  return prisma.$transaction(
    async (tx) => {
      // Lock the match so two admins cannot double-pay concurrently.
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status::text AS status FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE
      `;
      const current = locked[0];
      if (!current) throw ApiError.notFound('Match not found');
      if (current.status === 'CANCELLED') throw ApiError.conflict('This match was cancelled');

      const booked = await tx.tournamentSlot.findMany({
        where: { tournamentId },
        include: { user: { select: { id: true, isBanned: true } } },
      });
      const slotByUser = new Map(booked.map((s) => [s.userId, s]));

      // Already approved results — retries must never pay twice.
      const existing = await tx.matchResult.findMany({ where: { tournamentId } });
      const approvedByUser = new Map(existing.map((r) => [r.userId, r]));

      const paidSoFar = existing
        .filter((r) => r.isApproved)
        .reduce((sum, r) => sum + Number(r.prizeWon), 0);

      const skipped: PayoutAwardsResult['skipped'] = [];
      const breakdown: PayoutAwardsResult['breakdown'] = [];
      let totalPaid = 0;
      let playersPaid = 0;

      for (const award of awards) {
        const slot = slotByUser.get(award.userId);
        if (!slot) {
          throw ApiError.badRequest(
            `User ${award.userId} is not a participant of this match`,
          );
        }
        if (slot.isBanned) {
          throw ApiError.conflict(
            `Player ${slot.inGameNameSnapshot ?? slot.userId} is banned from this match`,
          );
        }
        if (slot.user.isBanned) {
          throw ApiError.conflict(
            `Player ${slot.inGameNameSnapshot ?? slot.userId} has a banned account`,
          );
        }
        if (approvedByUser.get(award.userId)?.isApproved) {
          skipped.push({ userId: award.userId, reason: 'already paid' });
          continue;
        }

        const rank = award.rank ?? null;
        const kills = Math.min(99, Math.max(0, Math.round(Number(award.kills ?? 0))));
        const isDisqualified = award.isDisqualified === true;

        // Disqualified: record a zero result, never credit money.
        if (isDisqualified) {
          await tx.matchResult.upsert({
            where: { tournamentId_userId: { tournamentId, userId: award.userId } },
            create: {
              tournamentId,
              userId: award.userId,
              verifiedKills: 0,
              rank: null,
              prizeWon: 0,
              isApproved: true,
              isDisqualified: true,
              disqualifyReason: award.disqualifyReason || 'Disqualified by admin',
              reviewedAt: new Date(),
            },
            update: {
              verifiedKills: 0,
              rank: null,
              prizeWon: 0,
              isApproved: true,
              isDisqualified: true,
              disqualifyReason: award.disqualifyReason || 'Disqualified by admin',
              reviewedAt: new Date(),
            },
          });
          breakdown.push({
            userId: award.userId,
            inGameUid: slot.inGameUidSnapshot,
            rank: null,
            verifiedKills: 0,
            prizePaid: 0,
            isDisqualified: true,
          });
          continue;
        }

        const prize =
          award.amount !== undefined && award.amount !== null
            ? round2(Math.max(0, Number(award.amount)))
            : computePrize(pool, perKill, rank, kills);

        if (paidSoFar + totalPaid + prize > pool + 0.001) {
          throw ApiError.badRequest(
            `Prize budget exceeded — pool ₹${round2(pool)}, already paid ₹${round2(paidSoFar + totalPaid)}`,
          );
        }

        if (prize > 0) {
          const credited = await tx.user.update({
            where: { id: award.userId },
            data: { winningBalance: { increment: prize } },
          });
          await tx.walletLedger.create({
            data: {
              tenantId: staff.tenantId,
              userId: award.userId,
              amount: prize,
              balanceType: 'WINNING',
              type: 'CREDIT',
              category: 'WINNING_PRIZE',
              balanceAfter: credited.winningBalance,
              referenceId: tournamentId,
              notes:
                award.note ||
                `Prize — rank ${rank ?? '-'} + ${kills} kill(s) for match ${tournament.matchNumber ?? '-'}`,
            },
          });
        }

        await tx.matchResult.upsert({
          where: { tournamentId_userId: { tournamentId, userId: award.userId } },
          create: {
            tournamentId,
            userId: award.userId,
            verifiedKills: kills,
            rank,
            prizeWon: prize,
            isApproved: true,
            isDisqualified: false,
            reviewedAt: new Date(),
          },
          update: {
            verifiedKills: kills,
            rank,
            prizeWon: prize,
            isApproved: true,
            isDisqualified: false,
            disqualifyReason: null,
            reviewedAt: new Date(),
          },
        });

        totalPaid = round2(totalPaid + prize);
        playersPaid += 1;
        breakdown.push({
          userId: award.userId,
          inGameUid: slot.inGameUidSnapshot,
          rank,
          verifiedKills: kills,
          prizePaid: prize,
          isDisqualified: false,
        });
      }

      let status = current.status;
      if (completeMatch) {
        const updated = await tx.tournament.update({
          where: { id: tournamentId },
          data: { status: 'COMPLETED' },
          select: { status: true },
        });
        status = updated.status;
      }

      return {
        tournamentId,
        status,
        totalPaid: round2(totalPaid),
        playersPaid,
        skipped,
        breakdown,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 20000,
    },
  );
}

export interface ParticipantBanResult {
  tournamentId: string;
  userId: string;
  matchBanned: boolean;
  accountBanned: boolean;
  banReason: string | null;
}

/**
 * Ban (or unban) a player for one match only, or across the whole account.
 * Account bans reuse the same instant-session-kill path as the player console
 * (auth cache invalidation), so the player is logged out on their next request.
 */
export async function banMatchParticipant(
  staff: AuthUser,
  tournamentId: string,
  userId: string,
  isBanned: boolean,
  reason?: string,
  banAccount: boolean = false,
): Promise<ParticipantBanResult> {
  await findMatchOrThrow(staff.tenantId, tournamentId);

  const slot = await prisma.tournamentSlot.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
    select: { id: true, user: { select: { id: true, role: true } } },
  });
  if (!slot) throw ApiError.notFound('This player is not in the match');

  const trimmedReason = reason?.trim() || null;

  await prisma.tournamentSlot.update({
    where: { id: slot.id },
    data: {
      isBanned,
      banReason: isBanned ? trimmedReason : null,
      bannedAt: isBanned ? new Date() : null,
      bannedBy: isBanned ? staff.userId : null,
    },
  });

  let accountBanned = false;
  if (banAccount && slot.user.role === 'USER') {
    await prisma.user.update({
      where: { id: userId },
      data: { isBanned },
    });
    invalidateAuthCache(userId);
    accountBanned = isBanned;
  }

  return {
    tournamentId,
    userId,
    matchBanned: isBanned,
    accountBanned,
    banReason: trimmedReason,
  };
}

/**
 * Spreadsheet-ready roster export for one match.
 *
 * Two blocks in one file (like the settlement CSV):
 *   1. a match header (identity + money totals) so the sheet explains itself
 *   2. one row per participant: slot, player ID, IGN, FF UID, phone, joined at,
 *      reward state, flags and ban state.
 *
 * This is the file an owner keeps for disputes ("who was in match 50 and what
 * did they get"), so every value comes from the join-time snapshot.
 */
export function buildRosterCsv(roster: RosterResponse): string {
  const { match, summary, participants } = roster;
  const lines: string[] = [];

  lines.push(`Match,${csvEscape(`${match.matchNumber ?? '-'} | ${match.mapType} ${match.matchType}`)}`);
  lines.push(`Status,${match.status}`);
  lines.push(`Match Time (IST),${formatIstForCsv(match.matchTime)}`);
  lines.push(`Entry Fee,${match.entryFee}`);
  lines.push(`Prize Pool,${match.prizePool}`);
  lines.push(`Per Kill,${match.perKillPrize}`);
  lines.push(`Seats,${match.slotsBooked}/${match.totalSlots}`);
  lines.push(`Entry Collected,${summary.totalEntryCollected}`);
  lines.push(`Prizes Paid,${summary.totalPrizePaid}`);
  lines.push(`Flagged Players,${summary.flagged}`);
  lines.push(`Banned Players,${summary.banned}`);
  lines.push('');
  lines.push(
    [
      'Slot',
      'Player ID',
      'Player Name',
      'In-Game Name',
      'Free Fire UID',
      'Phone',
      'Joined At (IST)',
      'Rank',
      'Kills',
      'Prize Paid',
      'Paid?',
      'Disqualified',
      'Banned (match)',
      'Banned (account)',
      'Ban Reason',
      'Flags',
    ].join(','),
  );

  for (const p of participants) {
    lines.push(
      [
        p.slotNumber,
        csvEscape(p.playerCode),
        csvEscape(p.name),
        csvEscape(p.inGameName),
        csvEscape(p.inGameUid),
        csvEscape(p.phoneNumber),
        formatIstForCsv(p.joinedAt),
        p.result?.rank ?? '',
        p.result?.verifiedKills ?? '',
        p.result?.prizeWon ?? '0',
        p.result?.isApproved ? 'YES' : 'NO',
        p.result?.isDisqualified ? 'YES' : 'NO',
        p.isBanned ? 'YES' : 'NO',
        p.accountBanned ? 'YES' : 'NO',
        csvEscape(p.banReason),
        csvEscape(p.flags.map((f) => f.code).join(' | ')),
      ].join(','),
    );
  }

  return lines.join('\r\n');
}

/** ISO instant -> "07/11/2026 16:00" in IST (spreadsheet friendly, no locale drift). */
function formatIstForCsv(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(ist.getUTCDate())}/${pad(ist.getUTCMonth() + 1)}/${ist.getUTCFullYear()} ` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`
  );
}
