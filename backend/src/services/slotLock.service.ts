import { randomInt } from 'node:crypto';
import { redis } from '../config/redis.js';

/**
 * Redis-backed atomic slot reservation for tournament joining.
 *
 * Why Redis: when 100+ players race for the last 2 seats, using the DB
 * unique-constraint as the ONLY guard means every loser pays a failed
 * transaction (and Postgres serialization aborts). Instead we reserve a seat
 * in Redis FIRST (single atomic Lua round-trip) and only touch the DB for the
 * winners. Database unique constraints remain the final correctness backstop.
 *
 * Key layout (single Redis instance):
 *   ff:slot:{tournamentId}            HASH slotNumber -> userId   (occupied seats)
 *   ff:joined:{tournamentId}          SET  userIds                 (one seat per user)
 *   ff:team:{tournamentId}:{code}     HASH {teamId, members, maxSize}   (squad grouping)
 *
 * Seat TTL = 2h, refreshed by every successful reservation. If a process
 * crashes between the Redis reserve and the DB commit, the seat self-heals by
 * expiring; getOccupiedSlots() re-hydrates from the DB when Redis is empty.
 */

const SEAT_TTL_MS = 2 * 60 * 60 * 1000; // 2h rolling TTL per seat
const TEAM_TTL_MS = 24 * 60 * 60 * 1000; // squad code valid for 24h

const slotKey = (tournamentId: string): string => `ff:slot:${tournamentId}`;
const joinedKey = (tournamentId: string): string => `ff:joined:${tournamentId}`;
const teamKey = (tournamentId: string, code: string): string => `ff:team:${tournamentId}:${code}`;

// ─── Lua scripts (based on the redlock acquire/release ownership pattern) ──

/** Atomically reserve one seat: capacity check + user dedupe + slot occupancy. */
const RESERVE_SCRIPT = `
-- KEYS[1] = slot hash key, KEYS[2] = joined set key
-- ARGV[1] = slotNumber, ARGV[2] = userId, ARGV[3] = maxSlots, ARGV[4] = ttl(ms)
if redis.call("SISMEMBER", KEYS[2], ARGV[2]) == 1 then
  return 2                        -- 2 = already joined this tournament
end
local occupied = redis.call("HLEN", KEYS[1])
if occupied >= tonumber(ARGV[3]) then
  return 3                        -- 3 = tournament full
end
if redis.call("HSETNX", KEYS[1], ARGV[1], ARGV[2]) == 0 then
  return 1                        -- 1 = slot already taken
end
redis.call("SADD", KEYS[2], ARGV[2])
redis.call("PEXPIRE", KEYS[1], ARGV[4])
redis.call("PEXPIRE", KEYS[2], ARGV[4])
return 0                          -- 0 = reserved
`;

/** Atomically free a seat (used to roll back after a failed DB transaction). */
const RELEASE_SCRIPT = `
-- KEYS[1] = slot hash key, KEYS[2] = joined set key
-- ARGV[1] = slotNumber, ARGV[2] = userId
if redis.call("HGET", KEYS[1], ARGV[1]) == ARGV[2] then
  redis.call("HDEL", KEYS[1], ARGV[1])
end
redis.call("SREM", KEYS[2], ARGV[2])
return 0
`;

/** Atomically create a squad, failing if the code is already taken. */
const CREATE_TEAM_SCRIPT = `
-- KEYS[1] = team hash key, ARGV[1] = teamId, ARGV[2] = maxSize, ARGV[3] = ttl(ms)
if redis.call("EXISTS", KEYS[1]) == 1 then
  return 0                        -- code collision, try another
end
redis.call("HSET", KEYS[1], "teamId", ARGV[1], "members", 1, "maxSize", ARGV[2])
redis.call("PEXPIRE", KEYS[1], ARGV[3])
return 1
`;

/** Atomically bump a squad's member count, rejecting when the team is full. */
const JOIN_TEAM_SCRIPT = `
-- KEYS[1] = team hash key, ARGV[1] = maxSize
if redis.call("EXISTS", KEYS[1]) == 0 then
  return 0                        -- 0 = team code not found
end
local members = redis.call("HINCRBY", KEYS[1], "members", 1)
if members > tonumber(ARGV[1]) then
  redis.call("HINCRBY", KEYS[1], "members", -1)
  return 2                        -- 2 = team full
end
redis.call("PEXPIRE", KEYS[1], ARGV[2])
return 1                          -- 1 = joined, teamId readable after
`;

export type ReserveFailureCode = 'SLOT_TAKEN' | 'ALREADY_JOINED' | 'TOURNAMENT_FULL';

export type ReserveResult =
  | { ok: true }
  | { ok: false; code: ReserveFailureCode };

/**
 * Atomically reserve slotNumber for userId. Returns before any DB work;
 * callers MUST releaseSlot() if the subsequent DB transaction fails.
 */
export async function reserveSlot(
  tournamentId: string,
  slotNumber: number,
  userId: string,
  maxSlots: number,
): Promise<ReserveResult> {
  if (redis.status !== 'ready') {
    return { ok: true };
  }
  const result = (await redis.eval(
    RESERVE_SCRIPT,
    2,
    slotKey(tournamentId),
    joinedKey(tournamentId),
    slotNumber,
    userId,
    maxSlots,
    SEAT_TTL_MS,
  )) as number;

  switch (result) {
    case 0:
      return { ok: true };
    case 1:
      return { ok: false, code: 'SLOT_TAKEN' };
    case 2:
      return { ok: false, code: 'ALREADY_JOINED' };
    default:
      return { ok: false, code: 'TOURNAMENT_FULL' };
  }
}

/** Release a previously-reserved seat (DB rollback path). */
export async function releaseSlot(
  tournamentId: string,
  slotNumber: number,
  userId: string,
): Promise<void> {
  if (redis.status !== 'ready') return;
  await redis.eval(RELEASE_SCRIPT, 2, slotKey(tournamentId), joinedKey(tournamentId), slotNumber, userId);
}

/**
 * Live view of occupied seats. Redis is the fast path; when Redis is empty but
 * the DB has seats (TTL expiry / crash recovery) we hydrate from the DB.
 */
export async function getOccupiedSlots(tournamentId: string): Promise<Record<number, string>> {
  if (redis.status !== 'ready') return {};
  try {
    const raw = await redis.hgetall(slotKey(tournamentId));
    const out: Record<number, string> = {};
    for (const [slot, userId] of Object.entries(raw)) {
      out[Number(slot)] = userId;
    }
    return out;
  } catch {
    return {};
  }
}

/** Re-populate Redis seat info from the DB (idempotent, TTL-safe). */
export async function hydrateSlotsFromDb(
  tournamentId: string,
  seats: Array<{ slotNumber: number; userId: string }>,
): Promise<void> {
  if (seats.length === 0 || redis.status !== 'ready') return;
  try {
    const pipe = redis.pipeline();
    for (const seat of seats) {
      pipe.hset(slotKey(tournamentId), String(seat.slotNumber), seat.userId);
      pipe.sadd(joinedKey(tournamentId), seat.userId);
    }
    pipe.pexpire(slotKey(tournamentId), SEAT_TTL_MS);
    pipe.pexpire(joinedKey(tournamentId), SEAT_TTL_MS);
    await pipe.exec();
  } catch {
    // ignore
  }
}

// ─── Squad team codes (DUO / SQUAD) ─────────────────────────────────────

/** Generate a unique 6-digit squad code (000000–999999). */
export function generateTeamCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Create a squad. Returns false if the code collides (caller should retry). */
export async function createTeam(
  tournamentId: string,
  code: string,
  teamId: string,
  maxSize: number,
): Promise<boolean> {
  if (redis.status !== 'ready') return true;
  try {
    const created = (await redis.eval(
      CREATE_TEAM_SCRIPT,
      1,
      teamKey(tournamentId, code),
      teamId,
      maxSize,
      TEAM_TTL_MS,
    )) as number;
    return created === 1;
  } catch {
    return true;
  }
}

export type JoinTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; code: 'NOT_FOUND' | 'TEAM_FULL' };

/** Join a squad by code. Returns the teamId on success (atomic capacity check). */
export async function joinTeam(
  tournamentId: string,
  code: string,
  maxSize: number,
): Promise<JoinTeamResult> {
  if (redis.status !== 'ready') {
    return { ok: true, teamId: code };
  }
  try {
    const key = teamKey(tournamentId, code);
    const result = (await redis.eval(JOIN_TEAM_SCRIPT, 1, key, maxSize, TEAM_TTL_MS)) as number;
    if (result === 0) return { ok: false, code: 'NOT_FOUND' };
    if (result === 2) return { ok: false, code: 'TEAM_FULL' };
    const teamId = await redis.hget(key, 'teamId');
    if (!teamId) return { ok: false, code: 'NOT_FOUND' };
    return { ok: true, teamId };
  } catch {
    return { ok: true, teamId: code };
  }
}

/** Roll back a team join (DB failure path). */
export async function decrementTeamMembers(tournamentId: string, code: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await redis.hincrby(teamKey(tournamentId, code), 'members', -1);
  } catch {
    // ignore
  }
}

/** Remove a squad entirely (leader rollback — the team never persisted). */
export async function deleteTeam(tournamentId: string, code: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    await redis.del(teamKey(tournamentId, code));
  } catch {
    // ignore
  }
}

/** Fetch the live member count of a squad. */
export async function getTeamMembers(tournamentId: string, code: string): Promise<number> {
  if (redis.status !== 'ready') return 0;
  try {
    const members = await redis.hget(teamKey(tournamentId, code), 'members');
    return members ? Number(members) : 0;
  } catch {
    return 0;
  }
}

/** Wipe all Redis state for a tournament (cancel / completion). */
export async function clearTournamentRedis(tournamentId: string): Promise<void> {
  if (redis.status !== 'ready') return;
  try {
    const keys = await redis.keys(`ff:team:${tournamentId}:*`);
    const pipe = redis.pipeline();
    pipe.del(slotKey(tournamentId));
    pipe.del(joinedKey(tournamentId));
    if (keys.length > 0) pipe.del(...keys);
    await pipe.exec();
  } catch {
    // ignore
  }
}