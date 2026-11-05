import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_ROOM_REVEAL_MINUTES,
  MAX_ROOM_REVEAL_MINUTES,
  MIN_ROOM_REVEAL_MINUTES,
  MINUTE_MS,
  formatRevealWindowLabel,
  isRoomUnlocked,
  resolveRoomRevealMinutes,
  roomRevealAt,
  roomRevealMeta,
  secondsUntilRoomReveal,
} from '../src/services/roomReveal.js';

const matchTime = new Date('2026-01-01T12:00:00.000Z');

describe('resolveRoomRevealMinutes', () => {
  it('defaults when missing', () => {
    assert.equal(resolveRoomRevealMinutes(null), DEFAULT_ROOM_REVEAL_MINUTES);
    assert.equal(resolveRoomRevealMinutes(undefined), DEFAULT_ROOM_REVEAL_MINUTES);
  });

  it('accepts the boundaries and rounds decimals', () => {
    assert.equal(resolveRoomRevealMinutes(MIN_ROOM_REVEAL_MINUTES), 1);
    assert.equal(resolveRoomRevealMinutes(MAX_ROOM_REVEAL_MINUTES), MAX_ROOM_REVEAL_MINUTES);
    assert.equal(resolveRoomRevealMinutes(14.6), 15);
  });

  it('rejects out-of-range values', () => {
    assert.throws(() => resolveRoomRevealMinutes(0), /roomRevealMinutes must be between/);
    assert.throws(() => resolveRoomRevealMinutes(-5), /roomRevealMinutes must be between/);
    assert.throws(() => resolveRoomRevealMinutes(MAX_ROOM_REVEAL_MINUTES + 1), /between/);
  });
});

describe('reveal window maths', () => {
  it('roomRevealAt subtracts the window from match time', () => {
    assert.equal(roomRevealAt(matchTime, 15).getTime(), matchTime.getTime() - 15 * MINUTE_MS);
  });

  it('isRoomUnlocked honours an explicit admin reveal', () => {
    const t = { matchTime, roomRevealMinutes: 60, roomRevealedAt: new Date('2026-01-01T00:00:00Z') };
    assert.equal(isRoomUnlocked(t, matchTime.getTime() - 10 * 60 * MINUTE_MS), true);
  });

  it('isRoomUnlocked uses the default window when minutes are null', () => {
    const t = { matchTime, roomRevealMinutes: null, roomRevealedAt: null };
    // Default window is 15 minutes before the match: later than that = locked.
    assert.equal(isRoomUnlocked(t, matchTime.getTime() - 16 * MINUTE_MS), false);
    assert.equal(isRoomUnlocked(t, matchTime.getTime() - 14 * MINUTE_MS), true);
  });

  it('secondsUntilRoomReveal counts down and floors at zero', () => {
    const t = { matchTime, roomRevealMinutes: 10, roomRevealedAt: null };
    assert.equal(secondsUntilRoomReveal(t, matchTime.getTime() - 12 * MINUTE_MS), 120);
    assert.equal(secondsUntilRoomReveal(t, matchTime.getTime()), 0);
  });
});

describe('formatRevealWindowLabel', () => {
  it('formats minutes, hours and hours+minutes', () => {
    assert.equal(formatRevealWindowLabel(1), '1 minute');
    assert.equal(formatRevealWindowLabel(45), '45 minutes');
    assert.equal(formatRevealWindowLabel(60), '1 hour');
    assert.equal(formatRevealWindowLabel(120), '2 hours');
    assert.equal(formatRevealWindowLabel(90), '1 hour 30 minutes');
    assert.equal(formatRevealWindowLabel(121), '2 hours 1 minute');
  });

  it('clamps nonsense input to a single minute', () => {
    assert.equal(formatRevealWindowLabel(0), '1 minute');
    assert.equal(formatRevealWindowLabel(-9), '1 minute');
  });
});

describe('roomRevealMeta', () => {
  it('reports locked state with a countdown', () => {
    const t = { matchTime, roomRevealMinutes: 30, roomRevealedAt: null };
    const meta = roomRevealMeta(t, matchTime.getTime() - 40 * MINUTE_MS);
    assert.equal(meta.roomUnlocked, false);
    assert.equal(meta.roomRevealMinutes, 30);
    assert.equal(meta.secondsUntilRoomReveal, 600);
    assert.equal(meta.roomRevealsAt, roomRevealAt(matchTime, 30).toISOString());
  });

  it('reports unlocked state with zero countdown', () => {
    const t = { matchTime, roomRevealMinutes: 15, roomRevealedAt: null };
    const meta = roomRevealMeta(t, matchTime.getTime());
    assert.equal(meta.roomUnlocked, true);
    assert.equal(meta.secondsUntilRoomReveal, 0);
  });
});
