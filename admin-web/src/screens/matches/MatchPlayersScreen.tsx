import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, ClipboardCheck, RefreshCw, Search, Trophy, Users } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useRealtime } from '../../context/RealtimeContext';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { cx, formatIST, humanize } from '../../lib/format';
import { matchHeadline, money } from '../../lib/matchUi';
import type { AdminTournament, MatchRoster, RosterParticipant, TournamentStatus } from '../../types';

/**
 * "View all joined players" — one seat per row, earliest join first.
 *
 * The roster endpoint already returns everything the control room knows
 * (slot, IGN, Free Fire UID, phone, join time, bans, kills, prize), so this
 * page is read-only: no scoring, no money. Ordering is by `joinedAt`, never by
 * slot number, because a player may pick a high seat and still be first in.
 */
export function MatchPlayersScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { version } = useRealtime();

  const [roster, setRoster] = useState<MatchRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        setRoster(await api.matches.roster(id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the joined players');
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // New seat, a ban or a payout while this page is open — pull it again.
  useEffect(() => {
    if (version > 0) void load(true);
  }, [version, load]);

  const participants = roster?.participants ?? [];
  const match = roster?.match;
  /** The roster row carries the same identity fields, typed as plain strings. */
  const headline = match ? matchHeadline(match as unknown as AdminTournament) : 'Joined players';

  /** Earliest join first; equal timestamps fall back to the seat number. */
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...participants]
      .sort(
        (a, b) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime() ||
          a.slotNumber - b.slotNumber,
      )
      .filter((player) => {
        if (!query) return true;
        return [
          String(player.slotNumber),
          player.inGameName ?? '',
          player.name ?? '',
          player.inGameUid ?? '',
          player.phoneNumber ?? '',
          player.playerCode ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }, [participants, search]);

  const joined = participants.length;
  const totalSlots = match?.totalSlots ?? 0;
  const remaining = Math.max(0, totalSlots - joined);
  const banned = participants.filter((player) => player.isBanned).length;

  if (loading && !roster) return <LoadingState rows={6} label="Loading joined players…" />;

  if (error && !roster) {
    return (
      <GlassCard flat>
        <EmptyState
          icon={Users}
          title="Could not load these players"
          description={error}
          action={
            <AppButton size="sm" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
              Go back
            </AppButton>
          }
        />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-1 inline-flex items-center gap-1 text-[11.5px] font-black uppercase tracking-wide text-cyan-700 hover:underline dark:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-black tracking-tight">
            <Users className="h-5 w-5 text-cyan-500" />
            {match ? headline : 'Joined players'}
            {match ? <StatusBadge status={match.status as TournamentStatus} /> : null}
          </h1>
          <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
            {match ? `${formatIST(match.matchTime)} • ${humanize(match.mapType)} • ${humanize(match.matchType)} • entry ${money(Number(match.entryFee))}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AppButton
            size="sm"
            variant="secondary"
            icon={<RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />}
            onClick={() => void load()}
          >
            Refresh
          </AppButton>
          {match ? (
            <AppButton
              size="sm"
              variant="primary"
              icon={<ClipboardCheck className="h-3.5 w-3.5" />}
              onClick={() => navigate(`/matches/${match.id}`)}
            >
              Score board
            </AppButton>
          ) : null}
        </div>
      </header>

      {/* Seat summary — filled, left, banned */}
      <GlassCard flat className="p-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-bold text-slate-700 dark:text-slate-300">
          <span>
            Joined <b className="text-emerald-700 dark:text-emerald-300">{joined}</b>/{totalSlots}
          </span>
          <span>
            Seats left <b className={remaining === 0 ? 'text-rose-600 dark:text-rose-300' : ''}>{remaining}</b>
          </span>
          <span>
            Banned <b className={banned > 0 ? 'text-rose-600 dark:text-rose-300' : ''}>{banned}</b>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            First join {rows.length > 0 ? formatIST(rows[0].joinedAt) : '—'}
          </span>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Slot, IGN, UID or phone…"
              aria-label="Search joined players"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-[12px] font-semibold outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-white/5"
            />
          </div>
        </div>
      </GlassCard>

      {rows.length === 0 ? (
        <GlassCard flat>
          <EmptyState
            icon={Users}
            title={search ? 'No player matches that search' : 'Nobody has joined yet'}
            description={
              search
                ? 'Clear the search to see every seat.'
                : 'Seats appear here the moment a player pays the entry fee.'
            }
          />
        </GlassCard>
      ) : (
        <GlassCard flat className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[56px_56px_1fr_150px_150px_120px] gap-2 bg-slate-100/70 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                <span>#</span>
                <span>Slot</span>
                <span>Player / IGN</span>
                <span>Free Fire UID</span>
                <span>Joined at</span>
                <span>Status</span>
              </div>

              {rows.map((player, index) => (
                <div
                  key={player.slotId}
                  className={cx(
                    'grid grid-cols-[56px_56px_1fr_150px_150px_120px] items-center gap-2 border-t border-slate-200/60 px-3 py-2 text-[12.5px] dark:border-white/5',
                    player.isBanned && 'bg-rose-50/60 dark:bg-rose-950/20',
                  )}
                >
                  <span className="text-[11.5px] font-bold tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <span className="text-[12.5px] font-black tabular-nums">
                    #{player.slotNumber}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cx(
                        'block truncate font-bold',
                        player.isBanned && 'text-rose-700 line-through dark:text-rose-300',
                      )}
                    >
                      {player.inGameName || player.name || player.playerCode || '—'}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {player.phoneNumber}
                      {player.playerCode ? ` • ${player.playerCode}` : ''}
                    </span>
                  </span>
                  <span className="truncate font-mono text-[12px] text-slate-600 dark:text-slate-300">
                    {player.inGameUid || '—'}
                  </span>
                  <span className="text-[11.5px] font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                    {formatIST(player.joinedAt)}
                  </span>
                  <span>
                    <PlayerStatus player={player} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      <SectionHeader
        title={`${rows.length} player${rows.length === 1 ? '' : 's'} shown`}
        subtitle="Earliest join is first. Tap Score board to record kills, ban a seat or pay out."
      />
    </div>
  );
}

/** One status chip per seat: banned > done > prize > plain seat. */
function PlayerStatus({ player }: { player: RosterParticipant }) {
  if (player.isBanned) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/40 bg-rose-500/10 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
        <Ban className="h-3 w-3" /> banned
      </span>
    );
  }
  const prize = Number(player.result?.prizeWon ?? 0);
  if (prize > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-black text-emerald-700 dark:text-emerald-300">
        <Trophy className="h-3 w-3" /> {money(prize)}
      </span>
    );
  }
  if (player.result?.isDisqualified) {
    return (
      <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
        DQ
      </span>
    );
  }
  return (
    <span className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      joined
    </span>
  );
}
