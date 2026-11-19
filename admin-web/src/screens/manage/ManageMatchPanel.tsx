import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CheckCircle2, Coins, Copy, Eye, Loader2, RotateCcw, Send, Undo2 } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { cx } from '../../lib/format';
import type { ManageBoard, ManageBoardPlayer, ManageMatchRow, PayoutAwardInput } from '../../types';
import { useToast } from '../../components/common/Toast';
import { useStepUp } from '../../context/StepUpContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useRealtime } from '../../context/RealtimeContext';
import { useSession } from '../../context/SessionContext';
import { can } from '../../lib/permissions';
import { collectedPool, roomShareText, whatsappShareUrl } from '../../lib/matchUi';

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);
const LIVE = new Set(['LIVE', 'UNDER_REVIEW']);

export function money(value: number): string {
  return `₹${value.toFixed(2)}`;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export function statusTone(status: string): string {
  if (status === 'LIVE') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (status === 'STARTING_SOON')
    return 'animate-pulse bg-amber-500/25 text-amber-800 dark:text-amber-200';
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
  mode = 'manage',
}: {
  match: ManageMatchRow;
  onMatchChanged: () => void;
  /**
   * 'manage' = live control room (score, ban, then Submit)
   * 'payout' = Final Payout desk (same board, money is released here with OTP)
   */
  mode?: 'manage' | 'payout';
}) {
  const isPayoutDesk = mode === 'payout';
  const { user } = useSession();
  const toast = useToast();
  /**
   * Section rights (owner bypasses everything):
   *   canManageMatch     → scoring, room, go live, submit, cancel
   *   canDistributePrize → release REAL money (payout, banned-seat refund)
   * A "Final payout (view)" staff member therefore sees the money but the pay
   * button explains why it is locked instead of failing with a 403.
   */
  const mayManageMatch = can(user, 'canManageMatch') || can(user, 'canCreateMatch');
  const mayPayMoney = can(user, 'canDistributePrize');
  const stepUp = useStepUp();
  const { version } = useRealtime();

  const [board, setBoard] = useState<ManageBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [roomId, setRoomId] = useState(match.roomId ?? '');
  const [roomPassword, setRoomPassword] = useState(match.roomPassword ?? '');

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmPayout, setConfirmPayout] = useState(false);
  const [banRefundTarget, setBanRefundTarget] = useState<ManageBoardPlayer | null>(null);
  const closed = CLOSED.has(match.status);
  const live = LIVE.has(match.status);
  /**
   * Kickoff has passed and the sweep parked the match in STARTING_SOON.
   * The players' app is showing "starting shortly — please wait", so this is
   * the exact moment the organiser has to press "Start match now" (and publish
   * the room first, if the lobby was never created).
   */
  const awaitingStart = match.status === 'STARTING_SOON';

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

  /**
   * Row order is FROZEN while kills are being typed. Sorting by kills on every
   * reload made the row jump away from the + − buttons the scorer is pressing;
   * the order is rebuilt only on an explicit action (✓ done, ✗ ban, publish,
   * start, submit) — those bump `orderVersion`.
   */
  const [rowOrder, setRowOrder] = useState<string[]>([]);
  const [orderVersion, setOrderVersion] = useState(0);
  const orderBuiltFor = useRef<number | null>(null);

  /** Alive players first (most kills up top), finished players sink below. */
  const ordered = useMemo(() => {
    const players = board?.players ?? [];
    const rankOf = new Map(rowOrder.map((userId, index) => [userId, index]));
    /** Stable fallback for a seat we have never positioned: its slot number. */
    const byFrozenOrder = (a: ManageBoardPlayer, b: ManageBoardPlayer) => {
      const rankA = rankOf.get(a.userId) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rankOf.get(b.userId) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.slotNumber - b.slotNumber;
    };
    const alive = players.filter((player) => !player.isEliminated).sort(byFrozenOrder);
    const done = players.filter((player) => player.isEliminated).sort(byFrozenOrder);
    return { alive, done };
  }, [board, rowOrder]);

  useEffect(() => {
    const players = board?.players;
    if (!players) return;
    if (orderBuiltFor.current === orderVersion) return;
    orderBuiltFor.current = orderVersion;
    const byKills = (a: ManageBoardPlayer, b: ManageBoardPlayer) =>
      b.kills - a.kills || a.slotNumber - b.slotNumber;
    setRowOrder([
      ...players.filter((player) => !player.isEliminated).sort(byKills).map((player) => player.userId),
      ...players.filter((player) => player.isEliminated).sort(byKills).map((player) => player.userId),
    ]);
  }, [orderVersion, board]);

  const payable = (board?.players ?? []).filter((player) => !player.isBanned);
  const totalKills = payable.reduce((sum, player) => sum + player.kills, 0);
  const payout = totalKills * match.perKillPrize;
  const budget = collectedPool({ entryFee: match.entryFee, slotsBooked: match.joined });
  // Money already credited to players by earlier partial payouts.
  const paidSoFar = (board?.players ?? []).reduce(
    (sum, player) => sum + (player.paid ?? 0),
    0,
  );
  /** Still owed after any earlier partial payout — what this click pays. */
  const dueNow = Math.max(0, Math.round((payout - paidSoFar) * 100) / 100);
  // Refunds already handed back (seat refunds + banned-seat refund switch).
  const refundedSoFar = (board?.players ?? []).reduce(
    (sum, player) => sum + (player.refunded ?? 0),
    0,
  );
  // What the money desk still has: collected - refunds - payouts - what is owed.
  const balance = budget - refundedSoFar - paidSoFar - payout;
  // Above the cash collected: allowed on the Final Payout desk, shown as a warning.
  const overPool = payout > budget + 0.001;

  /**
   * The Final Payout desk shows what every seat is owed (kills × per-kill)
   * right next to the kill control, so the money desk never needs the scoring
   * desk open beside it. Manage Matches keeps its compact 5-column board.
   */
  const boardCols = isPayoutDesk
    ? 'grid-cols-[52px_1fr_1fr_84px_92px_96px]'
    : 'grid-cols-[52px_1fr_1fr_92px_96px]';

  const run = async (
    key: string,
    action: () => Promise<unknown>,
    successText: string,
    /** Kills + / − keep the rows still; every other action may re-sort. */
    reorder: boolean = true,
  ) => {
    setBusy(key);
    try {
      await action();
      await load();
      onMatchChanged();
      // The action the scorer pressed (✓ done, ✗ ban, publish, start) is the
      // only thing allowed to re-sort the board.
      if (reorder) setOrderVersion((current) => current + 1);
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
      // Never re-sort on a kill tap: the row must stay under the cursor.
      false,
    );
  };

  /**
   * MANAGE MODE — "Submit" only hands the match over. No money moves and the
   * payout amount is not checked here, so a big prize pool never blocks the
   * submit. Paying happens on the Final Payout desk.
   */
  const submit = async () => {
    setBusy('submit');
    try {
      await api.manage.submitForPayout(match.id);
      setConfirmSubmit(false);
      toast.success('Submitted — this match moved to Final Payout');
      await load();
      onMatchChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Submit failed');
    } finally {
      setBusy(null);
    }
  };

  /**
   * PAYOUT MODE — release the money with a step-up OTP. Over-pool is allowed on
   * purpose: the owner can pay more than the match collected (guaranteed pool).
   */
  const finalPayout = async () => {
    const awards: PayoutAwardInput[] = payable
      .filter((player) => player.kills > 0)
      .map((player) => ({ userId: player.userId, rank: null, kills: player.kills }));

    setBusy('payout');
    try {
      /**
       * The owner's rule: the Final Payout desk never blocks the admin.
       *  - paying more than the match collected is allowed (allowOverPool)
       *  - a re-run only pays what is still missing (paid results are skipped)
       *  - a match that owes nothing still finishes (empty award list)
       */
      const result = await stepUp.run('paying out prizes', () =>
        api.manage.payout(match.id, awards, true, true),
      );
      setConfirmPayout(false);
      await load();
      onMatchChanged();
      toast.success(
        result.totalPaid > 0
          ? `Paid ${money(result.totalPaid)} to ${result.playersPaid} player(s) — match finished`
          : 'Match finished — no prize money was due',
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Payout failed');
    } finally {
      setBusy(null);
    }
  };

  const copyRoom = async () => {
    try {
      await navigator.clipboard.writeText(
        `Room ID: ${match.roomId ?? ''}
Password: ${match.roomPassword ?? ''}
#${match.matchNumber ?? ''} ${match.mapType} • ${match.matchType}`,
      );
      toast.success('Room ID & password copied');
    } catch {
      toast.error('Could not copy — select the fields manually');
    }
  };

  const revealRoom = async () => {
    await run(
      'reveal',
      () => api.matches.roomReveal(match.id),
      'Room credentials are now visible to joined players',
    );
  };

  return (
    <div className="space-y-4 border-t border-slate-200/70 px-4 py-4 dark:border-white/10">
      {/* ── Room, kickoff & cancel — Manage Matches only ─────────────────
          The Final Payout desk is a money desk: room codes, the live strip and
          "Start match now" belong to the control room, so they are not
          rendered here at all (keeps the two screens separate). */}
      {isPayoutDesk ? null : (
        <div className="space-y-4">
      {/* ── Kickoff passed: the players are waiting on this button ───── */}
      {awaitingStart ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-black uppercase tracking-wide">
            Kickoff time passed — players are waiting
          </p>
          <p className="mt-1 font-medium">
            The match does <strong>not</strong> go live on its own anymore. Players see
            “Starting shortly — please wait”.{' '}
            {match.roomPublished
              ? 'Press “Start match now” the moment the lobby is open in Free Fire.'
              : 'Publish the Room ID & Password first, then press “Start match now”.'}
          </p>
        </div>
      ) : null}

      {/* ── Room & kickoff ─────────────────────────────────────────── */}
      {/* The owner's rule: you must see the live state right here, next to the
          room code. Publish the room → the go-live button glows → press it and
          the match is LIVE. Nothing happens on the clock. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50/60 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">
        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Match
        </span>
        {closed ? (
          <span className="rounded-md border border-slate-300 bg-slate-200/70 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
            {statusLabel(match.status)}
          </span>
        ) : live ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/15 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> live
          </span>
        ) : (
          <span className="rounded-md border border-amber-400/50 bg-amber-400/15 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
            not live yet
          </span>
        )}

        <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Room
        </span>
        <span
          className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide ${
            match.roomPublished
              ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
              : match.hasRoomCredentials
                ? 'border-amber-400/50 bg-amber-400/10 text-amber-800 dark:text-amber-300'
                : 'border-slate-300 bg-slate-200/70 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300'
          }`}
        >
          {match.roomPublished ? 'published' : match.hasRoomCredentials ? 'hidden' : 'not published'}
        </span>

        <span className="ml-auto text-[11px] font-bold text-slate-500 dark:text-slate-400">
          {closed
            ? 'Match is over — nothing to start.'
            : live
              ? 'Players already see LIVE NOW in their app.'
              : match.roomPublished
                ? 'Room is live — press Start match now to go LIVE.'
                : 'Publish the Room ID & Password first, then start.'}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Room ID
          </span>
          <input
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            disabled={closed || live}
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
            disabled={closed || live}
            placeholder="e.g. 7712"
            className="w-full rounded-lg border border-slate-300/70 bg-white/80 px-3 py-2 text-sm font-semibold outline-none focus:border-cyan-500 disabled:opacity-60 dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled={closed || live || busy !== null || !roomId.trim() || !roomPassword.trim()}
            onClick={() =>
              void run(
                'room',
                () => api.manage.publishRoom(match.id, roomId.trim(), roomPassword.trim()),
                'Room published — players can see it now',
              )
            }
            title={
              live
                ? 'Match is LIVE — Room ID and Password are locked'
                : closed
                  ? 'Match is closed — nothing left to publish'
                  : match.roomPublished
                    ? 'Correct the room details before kickoff'
                    : 'Publish the room to joined players'
            }
            className={cx(
              'h-10 rounded-lg px-3 text-xs font-bold transition-all',
              // Live/closed -> plain black & white: the room is frozen.
              live || closed
                ? 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                : 'bg-cyan-600 text-white hover:bg-cyan-500',
            )}
          >
            {live || closed ? 'Room locked' : match.roomPublished ? 'Update room' : 'Publish room'}
          </button>
          <button
            type="button"
            disabled={closed || busy !== null || live || !match.hasRoomCredentials}
            onClick={() => void run('live', () => api.manage.goLive(match.id), 'Match is now LIVE')}
            className={cx(
              'h-10 rounded-lg px-3 text-xs font-black text-white transition-all disabled:opacity-40',
              live
                ? 'bg-emerald-700'
                : match.hasRoomCredentials
                  ? // Room published → this is the glowing action that goes LIVE.
                    'animate-pulse bg-emerald-600 ring-2 ring-emerald-400/70 shadow-[0_0_18px_rgba(16,185,129,0.55)] hover:animate-none hover:bg-emerald-500'
                  : 'bg-slate-500'
            )}
            title={
              live
                ? 'This match is already LIVE'
                : match.hasRoomCredentials
                  ? 'Room published — press to make the match LIVE for players'
                  : 'Publish the Room ID & Password first'
            }
          >
            {live ? '● LIVE' : 'Start match now'}
          </button>
          <button
            type="button"
            disabled={closed || busy !== null || !mayManageMatch}
            title={mayManageMatch ? 'Cancel this match and refund every seat' : 'You lack the Manage match permission'}
            onClick={() => setConfirmCancel(true)}
            className="h-10 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            Cancel & refund
          </button>
        </div>
      </div>

      {/* ── Live credentials: copy / share / reveal, right where the room lives ── */}
      {match.hasRoomCredentials ? (
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Room
            </span>
            <code className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[12px] font-bold dark:border-white/10 dark:bg-white/5">
              {match.roomId}
            </code>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pass
            </span>
            <code className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[12px] font-bold dark:border-white/10 dark:bg-white/5">
              {match.roomPassword}
            </code>
            <span
              className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide ${
                match.roomPublished
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-400/40 bg-amber-400/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              {match.roomPublished ? 'Players can see it' : 'Not revealed yet'}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => void copyRoom()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300/70 px-2.5 text-[11.5px] font-bold hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
              <a
                href={whatsappShareUrl(roomShareText({ ...match, room: { roomId: match.roomId ?? '', roomPassword: match.roomPassword ?? '' } }))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 text-[11.5px] font-bold text-emerald-700 hover:bg-emerald-400/20 dark:text-emerald-300"
              >
                <Send className="h-3.5 w-3.5" /> WhatsApp
              </a>
              {!match.roomPublished ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void revealRoom()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-600 px-2.5 text-[11.5px] font-bold text-white hover:bg-cyan-500 disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5" /> Reveal now
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
        </div>
      )}

      {/* ── Players ────────────────────────────────────────────────── */}
      {loading && !board ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading players…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
          <div
            className={cx(
              'grid gap-2 bg-slate-100/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400',
              boardCols,
            )}
          >
            <span>Slot</span>
            <span>Player / IGN</span>
            <span>Free Fire UID</span>
            {isPayoutDesk ? <span className="text-right">Prize</span> : null}
            <span className="text-center">Kills</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/60 bg-slate-50/50 px-3 py-1.5 text-[10.5px] font-semibold text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
            {isPayoutDesk ? null : <span>✓ done / undo</span>}
            <span>✗ ban / unban</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-amber-400 bg-amber-400/25 text-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.85)]">
                <Coins className="h-2.5 w-2.5" />
              </span>
              glow = banned player is refunded · off = ban only, no money back
            </span>
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
              cols={boardCols}
              payoutMode={isPayoutDesk}
              perKill={match.perKillPrize}
              allowMoney={mayPayMoney}
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
              onBanRefund={() => setBanRefundTarget(player)}
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
                  cols={boardCols}
                  payoutMode={isPayoutDesk}
                  perKill={match.perKillPrize}
                  allowMoney={mayPayMoney}
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
                  onBanRefund={() => setBanRefundTarget(player)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}

      {/* ── Money footer: Submit (Manage) / Final payout (Payout desk) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/60 px-3 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
          <span>
            Alive <b>{board?.aliveCount ?? 0}</b>/{board?.players.length ?? 0}
          </span>
          <span>
            Kills <b>{totalKills}</b> <span className="text-slate-400">(max {board?.maxKills ?? 0} per player)</span>
          </span>
          <span>Per kill {money(match.perKillPrize)}</span>
          {isPayoutDesk ? (
            <>
              <span>
                Collected <b>{money(budget)}</b>
              </span>
              <span>
                Refunded <b>{money(refundedSoFar)}</b>
              </span>
              <span>
                Paid <b>{money(paidSoFar)}</b>
              </span>
              <span>
                To pay <b className="text-violet-700 dark:text-violet-300">{money(payout)}</b>
              </span>
              <span
                className={
                  balance < 0
                    ? 'rounded-md bg-rose-500/10 px-1.5 py-0.5 text-rose-700 dark:text-rose-300'
                    : 'rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300'
                }
                title="Collected minus refunds, payouts and what is still owed"
              >
                {balance < 0 ? 'Short ' : 'Left '}
                <b>{money(Math.abs(balance))}</b>
              </span>
              {overPool ? (
                <span
                  className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-800 dark:text-amber-300"
                  title="Payout is more than this match collected — paying from the wallet"
                >
                  Above collected
                </span>
              ) : null}
            </>
          ) : (
            <span>
              Money in <b>{money(budget)}</b> · payout {money(payout)}
            </span>
          )}
        </div>
        {isPayoutDesk ? (
          mayPayMoney ? (
            <button
              type="button"
              disabled={closed || busy !== null}
              onClick={() => setConfirmPayout(true)}
              title={
                closed
                  ? 'This match is already closed'
                  : 'The money desk never blocks you — pay the balance, or just finish the match'
              }
              className="h-10 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {dueNow > 0
                ? `Final payout · pay ${money(dueNow)}`
                : paidSoFar > 0
                  ? 'Finish match · nothing left to pay'
                  : 'Finish match · nothing to pay'}
            </button>
          ) : (
            <span className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-[11.5px] font-bold text-amber-800 dark:text-amber-200">
              Paying needs the “Pay real money” permission
            </span>
          )
        ) : (
          <button
            type="button"
            disabled={closed || busy !== null || !mayManageMatch}
            onClick={() => setConfirmSubmit(true)}
            title={
              closed
                ? 'Match is closed — nothing left to submit'
                : 'Move this match to the Final Payout desk'
            }
            className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-black uppercase tracking-wide text-white hover:bg-violet-500 disabled:opacity-40"
          >
            Submit
          </button>
        )}
      </div>

      {/* Cancel & refund sits at the bottom of the money desk on purpose:
          paying is the main action, closing the whole match is the last one. */}
      {isPayoutDesk ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200/70 bg-rose-50/40 px-3 py-2.5 dark:border-rose-500/25 dark:bg-rose-950/15">
          <p className="text-[11.5px] font-semibold text-rose-800 dark:text-rose-200">
            Cancel &amp; refund closes this match and returns the entry fee to every eligible
            seat (a banned seat follows its coin switch). This cannot be undone.
          </p>
          <button
            type="button"
            disabled={closed || busy !== null || !mayManageMatch}
            title={mayManageMatch ? 'Cancel this match and refund every seat' : 'You lack the Manage match permission'}
            onClick={() => setConfirmCancel(true)}
            className="h-9 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            Cancel &amp; refund
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSubmit}
        title="Submit this match to Final Payout?"
        description={`${totalKills} kill(s) x ${money(match.perKillPrize)} = ${money(
          payout,
        )} will be paid from the Final Payout desk. No money moves now — banned players stay unpaid.`}
        confirmLabel="Submit"
        busy={busy === 'submit'}
        onConfirm={() => void submit()}
        onClose={() => setConfirmSubmit(false)}
      />

      <ConfirmDialog
        open={confirmPayout}
        title={
          dueNow > 0
            ? `Pay ${money(dueNow)} and finish this match?`
            : 'Finish this match with no money left to pay?'
        }
        description={
          dueNow > 0
            ? `${payable.filter((p) => p.kills > 0).length} player(s), ${totalKills} kills x ${money(
                match.perKillPrize,
              )}.${
                overPool
                  ? ' This is more than the match collected — the difference is paid from the admin wallet.'
                  : ''
              } Banned players get nothing. This posts to wallets and cannot be undone.`
            : totalKills === 0
              ? 'No confirmed kills on the board, so no kill prize is owed. The match will be marked COMPLETED and leaves the payout desk.'
              : 'Every kill prize from this match has already been paid. Press confirm to close the match as COMPLETED.'
        }
        confirmLabel={dueNow > 0 ? 'Pay & finish' : 'Finish match'}
        busy={busy === 'payout'}
        onConfirm={() => void finalPayout()}
        onClose={() => setConfirmPayout(false)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this match and refund everyone?"
        description={`Every joined player gets ${money(match.entryFee)} back and the match is closed — except banned players, who stay unpaid unless their refund switch is ON. This cannot be undone.`}
        confirmLabel="Cancel & refund all"
        danger
        busy={busy === 'cancel'}
        onConfirm={() =>
          void run(
            'cancel',
            () =>
              api.manage.cancel(
                match.id,
                isPayoutDesk ? 'Cancelled from Final Payout' : 'Cancelled from Manage Matches',
              ),
            'Match cancelled — eligible players refunded',
          ).then(() => setConfirmCancel(false))
        }
        onClose={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={banRefundTarget !== null}
        title={
          (banRefundTarget?.refunded ?? 0) > 0
            ? `Turn off the refund for ${banRefundTarget?.ign ?? 'this player'}?`
            : `Refund this banned player — ${banRefundTarget?.ign ?? 'player'}?`
        }
        description={
          (banRefundTarget?.refunded ?? 0) > 0
            ? `${money(banRefundTarget?.refunded ?? 0)} will be taken back from the wallet and the seat stays banned. If the player already spent it, this is rejected.`
            : `${money(match.entryFee)} goes back to the player's wallet, but the seat stays banned (out of the match, out of the payout).`
        }
        confirmLabel={(banRefundTarget?.refunded ?? 0) > 0 ? 'Refund off · ban only' : 'Refund the entry fee'}
        danger={(banRefundTarget?.refunded ?? 0) > 0}
        busy={busy === 'ban-refund'}
        onConfirm={() => {
          const target = banRefundTarget;
          if (!target) return;
          const turningOn = (target.refunded ?? 0) <= 0;
          void run(
            'ban-refund',
            () => api.manage.setBanRefund(match.id, target.userId, turningOn),
            turningOn
              ? `${target.ign} refunded ${money(match.entryFee)} (still banned)`
              : `Refund turned off for ${target.ign} — ban only`,
          ).then(() => setBanRefundTarget(null));
        }}
        onClose={() => setBanRefundTarget(null)}
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
  cols,
  payoutMode,
  perKill,
  allowMoney,
  onKills,
  onDone,
  onBan,
  onBanRefund,
}: {
  player: ManageBoardPlayer;
  maxKills: number;
  closed: boolean;
  canScore: boolean;
  busy: boolean;
  /** Column template, so the payout desk can add the Prize column. */
  cols: string;
  /** Final Payout desk: show kills × per-kill and hide scoring-only actions. */
  payoutMode: boolean;
  perKill: number;
  /** Can this viewer hand money back on a banned seat? */
  allowMoney: boolean;
  onKills: (kills: number) => void;
  onDone: () => void;
  onBan: () => void;
  onBanRefund: () => void;
}) {
  const locked = player.isBanned || player.isEliminated || !canScore || closed;
  /** Coin switch state: the banned seat already got its entry fee back. */
  const refunded = player.refunded ?? 0;
  const refundOn = refunded > 0;

  return (
    <div
      className={cx(
        'grid items-center gap-2 border-t border-slate-200/60 px-3 py-2 text-sm dark:border-white/5',
        cols,
        player.isBanned ? 'bg-rose-50/60 dark:bg-rose-950/20' : '',
      )}
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
          {player.isBanned ? (refundOn ? ` · banned · refunded ${money(refunded)}` : ' · banned · no refund') : ''}
          {player.isEliminated ? ' · done' : ''}
          {player.paid > 0 ? ` · paid ${money(player.paid)}` : ''}
        </span>
      </span>

      <span className="truncate font-mono text-[12px] text-slate-600 dark:text-slate-300">
        {player.freeFireUid}
      </span>

      {payoutMode ? (
        <span
          className={`text-right text-[12px] font-black tabular-nums ${
            player.isBanned
              ? 'text-slate-400 line-through dark:text-slate-500'
              : player.kills > 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-400 dark:text-slate-500'
          }`}
          title={
            player.isBanned
              ? 'Banned — this seat is never paid'
              : `${player.kills} kill(s) x ${money(perKill)}`
          }
        >
          {player.isBanned ? '—' : money(player.kills * perKill)}
        </span>
      ) : null}

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
        {payoutMode ? null : (
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
        )}
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
        {player.isBanned ? (
          <button
            type="button"
            title={
              refundOn
                ? 'Refund ON — this banned player already got the entry fee back. Click to take it back (ban only).'
                : 'Refund OFF — ban only, no money returned. Click to refund the entry fee to this banned player.'
            }
            aria-label={
              refundOn
                ? `Turn off refund for ${player.ign} (ban only)`
                : `Refund ${player.ign} even though they are banned`
            }
            aria-pressed={refundOn}
            disabled={closed || busy || player.kills > 0 || !allowMoney}
            onClick={onBanRefund}
            className={`h-7 w-7 rounded-md border text-[11px] font-bold transition disabled:opacity-30 ${
              refundOn
                ? 'border-amber-400 bg-amber-400/25 text-amber-600 shadow-[0_0_10px_rgba(251,191,36,0.85)] dark:border-amber-300 dark:text-amber-200'
                : 'border-slate-300 text-slate-400 dark:border-white/15 dark:text-slate-500'
            }`}
          >
            <Coins className="mx-auto h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

