import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Coins, Loader2, RotateCcw, Undo2 } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import type { ManageBoard, ManageBoardPlayer, ManageMatchRow, PayoutAwardInput } from '../../types';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useRealtime } from '../../context/RealtimeContext';

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);
const LIVE = new Set(['LIVE']);

export function money(value: number): string {
  return `₹${value.toFixed(2)}`;
}

export function statusTone(status: string): string {
  if (status === 'LIVE') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (status === 'CANCELLED') return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
  if (status === 'COMPLETED') return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
}

/**
 * Expanded body of one match row: publish the room, take it live, score every
 * player, ban/refund a seat, or cancel the whole thing. Every action refreshes
 * the board from the server, so a second admin clicking at the same time never
 * leaves this screen showing stale numbers.
 */
export function ManageMatchPanel({
  match,
  onMatchChanged,
}: {
  match: ManageMatchRow;
  onMatchChanged: () => void;
}) {
  const toast = useToast();
  const { version } = useRealtime();

  const [board, setBoard] = useState<ManageBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [roomId, setRoomId] = useState(match.roomId ?? '');
  const [roomPassword, setRoomPassword] = useState(match.roomPassword ?? '');

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [refundTarget, setRefundTarget] = useState<ManageBoardPlayer | null>(null);

  const closed = CLOSED.has(match.status);
  const live = LIVE.has(match.status) || match.status === 'SLOTS_FULL';

  const load = useCallback(async () => {
    try {
      const next = await api.manage.board(match.id);
      setBoard(next);
      setRoomId((current) => current || next.match.roomId || '');
      setRoomPassword((current) => current || next.match.roomPassword || '');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not load this match');
    } finally {
      setLoading(false);
    }
  }, [match.id, toast]);

  useEffect(() => {
    void load();
  }, [load, version]);

  /** Alive players first (most kills up top), finished players sink below. */
  const ordered = useMemo(() => {
    const players = board?.players ?? [];
    const alive = players
      .filter((player) => !player.isEliminated)
      .sort((a, b) => b.kills - a.kills || a.slotNumber - b.slotNumber);
    const done = players
      .filter((player) => player.isEliminated)
      .sort((a, b) => b.kills - a.kills || a.slotNumber - b.slotNumber);
    return { alive, done };
  }, [board]);

  const payable = (board?.players ?? []).filter((player) => !player.isBanned);
  const totalKills = payable.reduce((sum, player) => sum + player.kills, 0);
  const payout = totalKills * match.perKillPrize;
  const overPool = payout > match.prizePool + 0.001;

  const run = async (key: string, action: () => Promise<unknown>, successText: string) => {
    setBusy(key);
    try {
      await action();
      await load();
      onMatchChanged();
      toast.success(successText);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const setKills = (player: ManageBoardPlayer, kills: number) => {
    if (kills < 0 || kills > (board?.maxKills ?? 0)) return;
    void run(
      `kills:${player.userId}`,
      () => api.manage.setKills(match.id, player.userId, kills),
      `${player.ign} → ${kills} kill${kills === 1 ? '' : 's'}`,
    );
  };

  const submit = async () => {
    const awards: PayoutAwardInput[] = payable
      .filter((player) => player.kills > 0)
      .map((player) => ({ userId: player.userId, rank: null, kills: player.kills }));

    if (awards.length === 0) {
      toast.error('No kills recorded — nothing to pay');
      setConfirmSubmit(false);
      return;
    }

    setBusy('submit');
    try {
      await api.manage.payout(match.id, awards, true);
      setConfirmSubmit(false);
      await load();
      onMatchChanged();
      toast.success(`Paid ${money(totalKills * match.perKillPrize)} across ${awards.length} players`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Payout failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 border-t border-slate-200/70 px-4 py-4 dark:border-white/10">
      {/* ── Room & kickoff ─────────────────────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Room ID
          </span>
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            disabled={closed}
            placeholder="e.g. 4821993"
            className="w-full rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm font-semibold outline-none focus:border-cyan-500 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Room password
          </span>
          <input
            value={roomPassword}
            onChange={(event) => setRoomPassword(event.target.value)}
            disabled={closed}
            placeholder="e.g. 7712"
            className="w-full rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm font-semibold outline-none focus:border-cyan-500 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={closed || busy !== null || !roomId.trim() || !roomPassword.trim()}
            onClick={() =>
              void run(
                'room',
                () => api.manage.publishRoom(match.id, roomId.trim(), roomPassword.trim()),
                'Room published — players can see it now',
              )
            }
            className="h-10 rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
          >
            {match.roomPublished ? 'Update room' : 'Publish room'}
          </button>
          <button
            type="button"
            disabled={closed || busy !== null || live}
            onClick={() => void run('live', () => api.manage.goLive(match.id), 'Match is LIVE')}
            className="h-10 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {live ? 'Live' : 'Go live now'}
          </button>
          <button
            type="button"
            disabled={closed || busy !== null}
            onClick={() => setConfirmCancel(true)}
            className="h-10 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            Cancel & refund
          </button>
        </div>
      </div>

      {match.roomPublished ? (
        <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
          Published — players already see Room {match.roomId} / {match.roomPassword}.
        </p>
      ) : null}

      {/* ── Players ────────────────────────────────────────────────── */}
      {loading && !board ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading players…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
          <div className="grid grid-cols-[52px_1fr_1fr_92px_96px] gap-2 bg-slate-100/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <span>Slot</span>
            <span>Player / IGN</span>
            <span>Free Fire UID</span>
            <span className="text-center">Kills</span>
            <span className="text-right">Actions</span>
          </div>

          {board && board.players.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No player has joined this match yet.
            </p>
          ) : null}

          {ordered.alive.map((player) => (
            <PlayerRow
              key={player.userId}
              player={player}
              maxKills={board?.maxKills ?? 0}
              closed={closed}
              canScore={live && !closed}
              busy={busy === `kills:${player.userId}` || busy === `done:${player.userId}`}
              onKills={(next) => setKills(player, next)}
              onDone={() =>
                void run(
                  `done:${player.userId}`,
                  () => api.manage.setDone(match.id, player.userId, true),
                  `${player.ign} marked done`,
                )
              }
              onBan={() =>
                void run(
                  `ban:${player.userId}`,
                  () => api.manage.ban(match.id, player.userId, !player.isBanned, player.banReason ?? undefined),
                  player.isBanned ? 'Ban removed' : `${player.ign} banned`,
                )
              }
              onRefund={() => setRefundTarget(player)}
            />
          ))}

          {ordered.done.length > 0 ? (
            <>
              <div className="border-y border-slate-200/70 bg-slate-50/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                Finished — kills locked ({ordered.done.length})
              </div>
              {ordered.done.map((player) => (
                <PlayerRow
                  key={player.userId}
                  player={player}
                  maxKills={board?.maxKills ?? 0}
                  closed={closed}
                  canScore={live && !closed}
                  busy={busy === `done:${player.userId}`}
                  onKills={(next) => setKills(player, next)}
                  onDone={() =>
                    void run(
                      `done:${player.userId}`,
                      () => api.manage.setDone(match.id, player.userId, false),
                      `${player.ign} restored`,
                    )
                  }
                  onBan={() =>
                    void run(
                      `ban:${player.userId}`,
                      () => api.manage.ban(match.id, player.userId, !player.isBanned, player.banReason ?? undefined),
                      player.isBanned ? 'Ban removed' : `${player.ign} banned`,
                    )
                  }
                  onRefund={() => setRefundTarget(player)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* ── Submit footer ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          <span>
            Alive <b>{board?.aliveCount ?? 0}</b>/{board?.players.length ?? 0}
          </span>
          <span>
            Kills <b>{totalKills}</b> <span className="text-slate-400">(max {board?.maxKills ?? 0} per player)</span>
          </span>
          <span>
            Payout <b className={overPool ? 'text-rose-600 dark:text-rose-300' : ''}>{money(payout)}</b> of{' '}
            {money(match.prizePool)}
          </span>
          <span>Per kill {money(match.perKillPrize)}</span>
        </div>
        <button
          type="button"
          disabled={closed || busy !== null || totalKills === 0 || overPool}
          onClick={() => setConfirmSubmit(true)}
          className="h-10 rounded-lg bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Final submit · pay {money(payout)}
        </button>
      </div>

      <ConfirmDialog
        open={confirmSubmit}
        title={`Pay ${money(payout)} and finish this match?`}
        description={`${payable.filter((p) => p.kills > 0).length} player(s), ${totalKills} kills x ${money(
          match.perKillPrize,
        )}. Banned players get nothing. This posts to wallets and cannot be undone.`}
        confirmLabel="Pay & finish"
        busy={busy === 'submit'}
        onConfirm={() => void submit()}
        onClose={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this match and refund everyone?"
        description={`Every joined player gets ${money(match.entryFee)} back and the match is closed. This cannot be undone.`}
        confirmLabel="Cancel & refund all"
        danger
        busy={busy === 'cancel'}
        onConfirm={() =>
          void run(
            'cancel',
            () => api.manage.cancel(match.id, 'Cancelled from Manage Matches'),
            'Match cancelled — everyone refunded',
          ).then(() => setConfirmCancel(false))
        }
        onClose={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={refundTarget !== null}
        title={`Refund ${refundTarget?.ign ?? 'this player'}?`}
        description={`${money(match.entryFee)} goes back to their wallet and the seat is freed. The pool shrinks to match the seats left.`}
        confirmLabel="Refund seat"
        danger
        busy={busy === 'refund'}
        onConfirm={() => {
          const target = refundTarget;
          if (!target) return;
          void run(
            'refund',
            () => api.manage.refund(match.id, target.userId, 'Seat refunded from Manage Matches'),
            `${target.ign} refunded ${money(match.entryFee)}`,
          ).then(() => setRefundTarget(null));
        }}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
}

/** One scoreboard row: identity on the left, kill control and actions right. */
function PlayerRow({
  player,
  maxKills,
  closed,
  canScore,
  busy,
  onKills,
  onDone,
  onBan,
  onRefund,
}: {
  player: ManageBoardPlayer;
  maxKills: number;
  closed: boolean;
  canScore: boolean;
  busy: boolean;
  onKills: (kills: number) => void;
  onDone: () => void;
  onBan: () => void;
  onRefund: () => void;
}) {
  const locked = player.isBanned || player.isEliminated || !canScore || closed;

  return (
    <div
      className={`grid grid-cols-[52px_1fr_1fr_92px_96px] items-center gap-2 border-t border-slate-200/60 px-3 py-2 text-sm dark:border-white/5 ${
        player.isBanned ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
      }`}
    >
      <span className="text-[12px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
        #{player.slotNumber}
      </span>

      <span className="min-w-0">
        <span
          className={`block truncate font-bold ${
            player.isBanned ? 'text-rose-700 line-through dark:text-rose-300' : ''
          }`}
        >
          {player.ign}
        </span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {player.phoneNumber ?? 'no phone'}
          {player.isBanned ? ' · banned' : ''}
          {player.isEliminated ? ' · done' : ''}
          {player.paid > 0 ? ` · paid ${money(player.paid)}` : ''}
        </span>
      </span>

      <span className="truncate font-mono text-[12px] text-slate-600 dark:text-slate-300">
        {player.freeFireUid}
      </span>

      <span className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={`Remove a kill from ${player.ign}`}
          disabled={locked || busy || player.kills <= 0}
          onClick={() => onKills(player.kills - 1)}
          className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold leading-none disabled:opacity-30 dark:border-white/15"
        >
          −
        </button>
        <span className="w-6 text-center text-[13px] font-black tabular-nums">{player.kills}</span>
        <button
          type="button"
          aria-label={`Add a kill to ${player.ign}`}
          disabled={locked || busy || player.kills >= maxKills}
          onClick={() => onKills(player.kills + 1)}
          className="h-7 w-7 rounded-md border border-slate-300 text-sm font-bold leading-none disabled:opacity-30 dark:border-white/15"
        >
          +
        </button>
      </span>

      <span className="flex items-center justify-end gap-1">
        <button
          type="button"
          title={player.isEliminated ? 'Undo done' : 'Mark done (no more kills)'}
          aria-label={player.isEliminated ? `Undo done for ${player.ign}` : `Mark ${player.ign} done`}
          disabled={closed || busy || player.isBanned || !canScore}
          onClick={onDone}
          className={`h-7 w-7 rounded-md border text-[11px] font-bold disabled:opacity-30 ${
            player.isEliminated
              ? 'border-amber-400 text-amber-700 dark:text-amber-300'
              : 'border-emerald-400 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {player.isEliminated ? <Undo2 className="mx-auto h-3.5 w-3.5" /> : <CheckCircle2 className="mx-auto h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          title={player.isBanned ? 'Remove ban' : 'Ban from this match'}
          aria-label={player.isBanned ? `Remove ban from ${player.ign}` : `Ban ${player.ign}`}
          disabled={closed || busy}
          onClick={onBan}
          className={`h-7 w-7 rounded-md border text-[11px] font-bold disabled:opacity-30 ${
            player.isBanned ? 'border-rose-500 text-rose-700 dark:text-rose-300' : 'border-slate-300 dark:border-white/15'
          }`}
        >
          {player.isBanned ? <RotateCcw className="mx-auto h-3.5 w-3.5" /> : <Ban className="mx-auto h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          title="Refund this seat"
          aria-label={`Refund ${player.ign}`}
          disabled={closed || busy || player.kills > 0}
          onClick={onRefund}
          className="h-7 w-7 rounded-md border border-slate-300 text-[11px] font-bold disabled:opacity-30 dark:border-white/15"
        >
          <Coins className="mx-auto h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

