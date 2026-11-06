/**
 * Seat locking: Redis is the fast atomic guard in front of the DB transaction.
 * Every path here must degrade gracefully (Redis down => DB constraints decide)
 * and every Lua return code must map to the right business failure.
 */
import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

type SlotApi = typeof import('../src/services/slotLock.service.js');
let api: SlotApi;

/** Minimal Redis stand-in: tests set `reply` per call. */
const redisMock: any = {
  status: 'ready',
  reply: 0 as number,
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  hashes: {} as Record<string, Record<string, string>>,
  pipeline: () => {
    const queued: Array<() => void> = [];
    const pipe: any = {
      hset: (key: string, field: string, value: string) => {
        queued.push(() => {
          redisMock.hashes[key] = { ...(redisMock.hashes[key] ?? {}), [field]: value };
        });
        return pipe;
      },
      sadd: () => pipe,
      pexpire: () => pipe,
      del: (key: string) => {
        queued.push(() => {
          delete redisMock.hashes[key];
        });
        return pipe;
      },
      exec: async () => {
        queued.forEach((fn) => fn());
        return [];
      },
    };
    return pipe;
  },
};

before(async () => {
  mock.module('../src/config/redis.js', {
    namedExports: {
      redis: new Proxy({} as any, {
        get: (_t, prop: string) => {
          if (prop === 'eval') {
            return async (script: string, _keys: number, ...args: unknown[]) => {
              redisMock.calls.push({ cmd: 'eval', args });
              if (typeof redisMock.evalReply === 'function') return redisMock.evalReply(args);
              return redisMock.reply;
            };
          }
          if (prop === 'hgetall') {
            return async (key: string) => redisMock.hashes[key] ?? {};
          }
          if (prop === 'hget') {
            return async (key: string, field: string) => redisMock.hashes[key]?.[field] ?? null;
          }
          if (prop === 'hincrby' || prop === 'del' || prop === 'sadd' || prop === 'hset') {
            return async (...args: unknown[]) => {
              redisMock.calls.push({ cmd: prop, args });
              return 1;
            };
          }
          if (prop === 'keys') return async () => ['ff:team:t1:123456'];
          if (prop === 'pipeline') return redisMock.pipeline;
          if (prop === 'status') return redisMock.status;
          return redisMock[prop];
        },
      }),
      disconnectRedis: async () => {},
    },
  });
  api = await import('../src/services/slotLock.service.js');
});

beforeEach(() => {
  redisMock.status = 'ready';
  redisMock.reply = 0;
  redisMock.calls = [];
  redisMock.hashes = {};
  redisMock.evalReply = undefined;
});

describe('reserveSlot', () => {
  it('maps every Lua return code to a business failure', async () => {
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: true });
    assert.equal(redisMock.calls.length, 1);

    redisMock.reply = 1;
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: false, code: 'SLOT_TAKEN' });

    redisMock.reply = 2;
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: false, code: 'ALREADY_JOINED' });

    redisMock.reply = 3;
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: false, code: 'TOURNAMENT_FULL' });
  });

  it('falls back to the DB when Redis is down or blows up', async () => {
    redisMock.status = 'end';
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: true });
    assert.equal(redisMock.calls.length, 0, 'no Redis call when disconnected');

    redisMock.status = 'ready';
    redisMock.evalReply = () => {
      throw new Error('connection lost');
    };
    assert.deepEqual(await api.reserveSlot('t1', 1, 'u1', 48), { ok: true });
  });
});

describe('release + hydrate', () => {
  it('releases a seat and swallows Redis errors', async () => {
    await api.releaseSlot('t1', 3, 'u1');
    assert.equal(redisMock.calls[0].cmd, 'eval');

    redisMock.evalReply = () => {
      throw new Error('boom');
    };
    await assert.doesNotReject(() => api.releaseSlot('t1', 3, 'u1'));
  });

  it('reads occupied seats from Redis and survives failures', async () => {
    redisMock.hashes['ff:slot:t1'] = { 1: 'u1', 7: 'u2' };
    assert.deepEqual(await api.getOccupiedSlots('t1'), { 1: 'u1', 7: 'u2' });

    redisMock.status = 'end';
    assert.deepEqual(await api.getOccupiedSlots('t1'), {});
  });

  it('re-hydrates Redis from DB seats', async () => {
    await api.hydrateSlotsFromDb('t1', [
      { slotNumber: 1, userId: 'u1' },
      { slotNumber: 2, userId: 'u2' },
    ]);
    assert.deepEqual(redisMock.hashes['ff:slot:t1'], { 1: 'u1', 2: 'u2' });

    redisMock.calls = [];
    await api.hydrateSlotsFromDb('t1', []);
    assert.equal(redisMock.calls.length, 0, 'nothing to hydrate');
  });
});

describe('squad teams', () => {
  it('generates a 6-digit code and detects collisions', async () => {
    for (let i = 0; i < 20; i += 1) assert.match(api.generateTeamCode(), /^\d{6}$/);

    redisMock.reply = 1;
    assert.equal(await api.createTeam('t1', '123456', 'team-1', 4), true);

    redisMock.reply = 0;
    assert.equal(await api.createTeam('t1', '123456', 'team-1', 4), false, 'code already taken');
  });

  it('joins a squad, reporting missing codes and full teams', async () => {
    redisMock.hashes['ff:team:t1:123456'] = { teamId: 'team-1', members: '2', maxSize: '4' };
    redisMock.reply = 1;
    assert.deepEqual(await api.joinTeam('t1', '123456', 4), { ok: true, teamId: 'team-1' });

    redisMock.reply = 0;
    assert.deepEqual(await api.joinTeam('t1', '000000', 4), { ok: false, code: 'NOT_FOUND' });

    redisMock.reply = 2;
    assert.deepEqual(await api.joinTeam('t1', '123456', 4), { ok: false, code: 'TEAM_FULL' });

    redisMock.reply = 1;
    assert.deepEqual(await api.joinTeam('t1', '999999', 4), { ok: false, code: 'NOT_FOUND' }, 'no teamId in Redis');
  });

  it('counts members, decrements, deletes and clears tournament state', async () => {
    redisMock.hashes['ff:team:t1:123456'] = { members: '3' };
    assert.equal(await api.getTeamMembers('t1', '123456'), 3);
    assert.equal(await api.getTeamMembers('t1', 'missing'), 0);

    await api.decrementTeamMembers('t1', '123456');
    await api.deleteTeam('t1', '123456');
    await api.clearTournamentRedis('t1');
    assert.ok(redisMock.calls.some((c) => c.cmd === 'hincrby'));
    assert.ok(redisMock.calls.some((c) => c.cmd === 'del'));
  });

  it('treats a Redis outage as a no-op', async () => {
    redisMock.status = 'end';
    assert.equal(await api.createTeam('t1', '1', 'team', 4), true);
    assert.deepEqual(await api.joinTeam('t1', '1', 4), { ok: true, teamId: '1' });
    assert.equal(await api.getTeamMembers('t1', '1'), 0);
    await assert.doesNotReject(() => api.decrementTeamMembers('t1', '1'));
    await assert.doesNotReject(() => api.deleteTeam('t1', '1'));
    await assert.doesNotReject(() => api.clearTournamentRedis('t1'));
    await assert.doesNotReject(() => api.hydrateSlotsFromDb('t1', [{ slotNumber: 1, userId: 'u' }]));
  });
});
