import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  Flag,
  ListChecks,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trophy,
  Undo2,
  Users,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useSession } from '../../context/SessionContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { FormDialog } from '../../components/common/FormDialog';
import { formatIST, humanize } from '../../lib/format';
import {
  DEFAULT_PRIZE_RULES,
  computePrize,
  displayName,
  money,
  roomShareText,
  whatsappShareUrl,
} from '../../lib/matchUi';
import { Chip, Field, InlineError, InfoNote, TextInput, Toggle } from './MatchFormBits';
import type {
  MatchRoster,
  MatchRoomCredentials,
  PayoutAwardsResult,
  PayoutAwardInput,
  RosterFilter,
  RosterParticipant,
} from '../../types';

interface EditRow {
  rank: string;
  kills: string;
  dq: boolean;
  dqReason: string;
}

const EMPTY_EDIT: EditRow = { rank: '', kills: '', dq: false, dqReason: '' };

const FILTERS: Array<{ id: RosterFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'banned', label: 'Banned' },
  { id: 'dq', label: 'DQ' },
];

function editsFromRoster(roster: MatchRoster): Record<string, EditRow> {
  const next: Record<string, EditRow> = {};
  for (const participant of roster.participants) {
    next[participant.userId] = {
      rank: participant.result?.rank != null ? String(participant.result.rank) : '',
      kills: participant.result ? String(participant.result.verifiedKills) : '',
      dq: participant.result?.isDisqualified ?? false,
      dqReason: participant.result?.disqualifyReason ?? '',
    };
  }
  return next;
}

function isPaid(participant: RosterParticipant): boolean {
  return participant.result?.isApproved === true;
}

function isPayoutEligible(participant: RosterParticipant): boolean {
  return !participant.isBanned && !participant.accountBanned && !isPaid(participant);
}

/**
 * Match Control — the canonical payout screen (Phase 4 stage 3).
 *
 * One place for everything after kickoff: the full participant roster with
 * join-time IGN/FF UID, cheat flags, rank + kills entry, DQ, ban and the single
 * "save results & complete match" action. The old per-player payout buttons are
 * intentionally not exposed here (Android still uses its own endpoint).
 */
export function MatchControlScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useSession();
  const { version } = useRealtime();

  const canPrize = user?.role === 'ADMIN' || Boolean(user?.permissions?.canDistributePrize);

  const [roster, setRoster] = useState<MatchRoster | null>(null);
  const [room, setRoom] = useState<MatchRoomCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [banner, setBanner] = useState('');
  const [edits, setEdits] = useState<Record<string, EditRow>>({});
  const [dirty, setDirty] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RosterFilter>('all');

  const [saving, setSaving] = useState<'complete' | 'review' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState<'complete' | 'review' | null>(null);
  const [payoutResult, setPayoutResult] = useState<PayoutAwardsResult | null>(null);

  const [banTarget, setBanTarget] = useState<RosterParticipant | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banAccount, setBanAccount] = useState(false);
  const [banBusy, setBanBusy] = useState(false);

  const matchId = id ?? '';

  const load = useCallback(
    async (silent = false) => {
      if (!matchId) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        const [data, roomData] = await Promise.all([
          api.matches.roster(matchId),
          api.matches.room(matchId).catch(() => null),
        ]);
        setRoster(data);
        setRoom(roomData);
        setEdits((current) => {
          if (dirty) return current;
          return editsFromRoster(data);
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load the match roster');
      } finally {
        setLoading(false);
      }
    },
    [matchId, dirty]
  );

  useEffect(() => {
    setDirty(false);
    setEdits({});
    setRoster(null);
    setRoom(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (version > 0 && !dirty) void load(true);
  }, [version, dirty, load]);

  const pool = roster ? Number(roster.match.prizePool) : 0;
  const perKill = roster ? Number(roster.match.perKillPrize) : 0;
  const rules = roster?.prizeRules ?? DEFAULT_PRIZE_RULES;

  // Real payout gate (status enum lives in the roster payload as a string).
  const payoutOpen = roster
    ? ['OPEN', 'SLOTS_FULL', 'ROOM_REVEALED', 'LIVE', 'UNDER_REVIEW'].includes(roster.match.status)
    : false;

  const update = (userId: string, patch: Partial<EditRow>) => {
    setEdits((current) => ({ ...current, [userId]: { ...(current[userId] ?? EMPTY_EDIT), ...patch } }));
    setDirty(true);
    setActionError('');
  };

  const previewOf = (participant: RosterParticipant): number => {
    if (!roster) return 0;
    const edit = edits[participant.userId] ?? EMPTY_EDIT;
    if (edit.dq) return 0;
    const rank = Number(edit.rank);
    const kills = Number(edit.kills || 0);
    return computePrize(pool, perKill, Number.isInteger(rank) && rank > 0 ? rank : null, kills, rules);
  };

  const participants = roster?.participants ?? [];

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return participants.filter((participant) => {
      if (filter === 'flagged' && participant.flags.length === 0) return false;
      if (filter === 'unpaid' && isPaid(participant)) return false;
      if (filter === 'banned' && !participant.isBanned && !participant.accountBanned) return false;
      if (filter === 'dq' && !(edits[participant.userId]?.dq ?? participant.result?.isDisqualified)) return false;

      if (!query) return true;
      return [
        participant.playerCode ?? '',
        participant.inGameName ?? '',
        participant.name ?? '',
        participant.inGameUid ?? '',
        participant.phoneNumber,
        String(participant.slotNumber),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [participants, search, filter, edits]);

  const eligible = useMemo(() => participants.filter(isPayoutEligible), [participants]);

  const awards = useMemo<PayoutAwardInput[]>(() => {
    return eligible.map((participant) => {
      const edit = edits[participant.userId] ?? EMPTY_EDIT;
      const rankValue = Number(edit.rank);
      const rank = !edit.dq && Number.isInteger(rankValue) && rankValue >= 1 ? rankValue : null;
      const kills = edit.dq ? 0 : Math.min(99, Math.max(0, Math.round(Number(edit.kills || 0))));
      return {
        userId: participant.userId,
        rank,
        kills,
        isDisqualified: edit.dq,
        ...(edit.dq
          ? { disqualifyReason: edit.dqReason.trim() || 'Disqualified by admin' }
          : {}),
      };
    });
  }, [eligible, edits]);

  const totalPreview = useMemo(
    () => eligible.reduce((sum, participant) => sum + previewOf(participant), 0),
    // previewOf depends on edits/pool/perKill → listed explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligible, edits, pool, perKill, rules]
  );

  const rankedCount = awards.filter((award) => !award.isDisqualified && award.rank != null).length;
  const unrankedCount = awards.filter((award) => !award.isDisqualified && award.rank == null).length;
  const dqCount = awards.filter((award) => award.isDisqualified).length;
  const overBudget = totalPreview > pool + 0.001;

  const save = async (mode: 'complete' | 'review') => {
    if (!roster || saving) return;
    if (!canPrize) {
      setActionError('Your account has no payout permission (canDistributePrize).');
      setConfirm(null);
      return;
    }
    if (!awards.length) {
      setActionError('There is no unpaid participant left to save.');
      setConfirm(null);
      return;
    }
    if (overBudget) {
      setActionError(`Prize budget exceeded — pool ${money(pool)}, preview ${money(totalPreview)}.`);
      setConfirm(null);
      return;
    }

    setSaving(mode);
    setActionError('');
    setBanner('');
    try {
      const result = await api.matches.payout(roster.match.id, awards, mode === 'complete');
      setPayoutResult(result);
      setConfirm(null);
      setDirty(false);
      setBanner(
        `${money(result.totalPaid)} paid to ${result.playersPaid} player(s)` +
          (result.skipped.length ? ` • ${result.skipped.length} skipped (already paid)` : '') +
          (mode === 'complete' ? ' • match COMPLETED' : ' • results saved, match still open')
      );
      toast.success(mode === 'complete' ? 'Results saved — match completed' : 'Results saved');
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save the results');
    } finally {
      setSaving(null);
    }
  };

  const fillRanks = () => {
    let rank = 1;
    const next = { ...edits };
    for (const participant of eligible) {
      const edit = next[participant.userId] ?? EMPTY_EDIT;
      if (edit.dq) continue;
      next[participant.userId] = { ...edit, rank: String(rank) };
      rank += 1;
    }
    setEdits(next);
    setDirty(true);
  };

  const clearRanks = () => {
    const next = { ...edits };
    for (const participant of eligible) {
      const edit = next[participant.userId] ?? EMPTY_EDIT;
      next[participant.userId] = { ...edit, rank: '', kills: '' };
    }
    setEdits(next);
    setDirty(true);
  };

  const exportCsv = async () => {
    if (!roster || exporting) return;
    setExporting(true);
    try {
      const label = roster.match.matchNumber != null ? `match-${roster.match.matchNumber}` : 'match';
      await api.matches.downloadRosterCsv(roster.match.id, `roster-${label}.csv`);
      toast.success('Roster exported');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export the roster');
    } finally {
      setExporting(false);
    }
  };

  const openBan = (participant: RosterParticipant) => {
    setBanTarget(participant);
    setBanReason(participant.banReason ?? '');
    setBanAccount(participant.accountBanned);
    setActionError('');
  };

  const submitBan = async (isBanned: boolean) => {
    if (!banTarget || !roster || banBusy) return;
    if (isBanned && banReason.trim().length < 3) {
      setActionError('Give a short reason (min 3 characters).');
      return;
    }

    setBanBusy(true);
    setActionError('');
    try {
      await api.matches.banParticipant(roster.match.id, banTarget.userId, {
        isBanned,
        reason: isBanned ? banReason.trim() : undefined,
        banAccount,
      });
      toast.success(
        !isBanned
          ? `${displayName(banTarget)} unbanned`
          : banAccount
            ? `${displayName(banTarget)} account banned — logged out instantly`
            : `${displayName(banTarget)} banned from this match`
      );
      setBanTarget(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update the ban');
    } finally {
      setBanBusy(false);
    }
  };

  // ── Loading / fatal error states ─────────────────────────────────
  if (loading && !roster) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All matches
        </button>
        <LoadingState rows={6} label="Loading match roster…" />
      </div>
    );
  }

  if (!roster) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/matches')}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-950 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All matches
        </button>
        <GlassCard flat>
          <EmptyState
            icon={ShieldAlert}
            title="Roster not available"
            description={error || 'The match could not be loaded.'}
            action={
              <AppButton size="sm" variant="secondary" onClick={() => void load()}>
                Try again
              </AppButton>
            }
          />
        </GlassCard>
      </div>
    );
  }

  const headline = roster.match.matchNumber != null ? `#${roster.match.matchNumber} ${humanize(roster.match.mapType)} • ${humanize(roster.match.matchType)}` : roster.match.title;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/matches')}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-950 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All matches
      </button>

      <SectionHeader
        eyebrow="Phase 4 · Live scorer"
        title={headline}
        subtitle={`${formatIST(roster.match.matchTime)} • ${roster.match.slotsBooked}/${roster.match.totalSlots} seats • ₹${Number(roster.match.entryFee)} entry • ₹${pool} pool • ₹${perKill}/kill`}
        action={
          <>
            <StatusBadge status={roster.match.status} />
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              loading={exporting}
              onClick={() => void exportCsv()}
            >
              CSV
            </AppButton>
          </>
        }
      />

      {!canPrize && (
        <InlineError>
          Read-only: this account has no payout permission (canDistributePrize). You can review the roster and
          export the CSV, but results cannot be saved.
        </InlineError>
      )}

      {banner && (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] px-3 py-2 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {banner}
        </p>
      )}
      {actionError && <InlineError>{actionError}</InlineError>}

      {/* ── Room credentials (same reveal the players see) ────── */}
      {room && (
        <GlassCard flat className="flex flex-wrap items-center gap-x-5 gap-y-2 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Room ID</span>
            <span className="font-mono text-[13px] font-black">{room.roomId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Password</span>
            <span className="font-mono text-[13px] font-black">{room.roomPassword}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <AppButton
              size="sm"
              variant="secondary"
              icon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => {
                void navigator.clipboard
                  .writeText(roomShareText({ ...roster.match, room }))
                  .then(() => toast.success('Room details copied'))
                  .catch(() => toast.error('Could not copy — select the room text manually'));
              }}
            >
              Copy
            </AppButton>
            <a
              href={whatsappShareUrl(roomShareText({ ...roster.match, room }))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.03]"
            >
              WhatsApp
            </a>
            <AppButton size="sm" variant="secondary" onClick={() => navigate('/matches/publish')}>
              Update room
            </AppButton>
          </div>
        </GlassCard>
      )}

      {/* ── Summary strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Participants', value: String(roster.summary.total), icon: Users },
          { label: 'Flagged', value: String(roster.summary.flagged), icon: Flag },
          { label: 'Paid', value: `${roster.summary.paid}/${roster.summary.total}`, icon: CheckCircle2 },
          { label: 'Entry collected', value: money(Number(roster.summary.totalEntryCollected)), icon: ListChecks },
          { label: 'Prizes paid', value: money(Number(roster.summary.totalPrizePaid)), icon: Trophy },
          { label: 'Prize pool', value: money(pool), icon: ShieldAlert },
        ].map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} flat className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1 text-[15px] font-black leading-none">{value}</p>
          </GlassCard>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <GlassCard flat className="p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search slot, Player ID, IGN, FF UID, phone…"
              aria-label="Search roster"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-[12px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#FFD000]/70 dark:border-white/10 dark:bg-[#060B14] dark:text-white dark:placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-1 flex-wrap gap-1.5">
            {FILTERS.map(({ id: filterId, label }) => (
              <Chip key={filterId} active={filter === filterId} onClick={() => setFilter(filterId)}>
                {label}
              </Chip>
            ))}
          </div>

          {payoutOpen && canPrize && (
            <div className="flex gap-1.5">
              <AppButton
                size="sm"
                variant="secondary"
                icon={<ListChecks className="h-3.5 w-3.5" />}
                onClick={fillRanks}
                disabled={!eligible.length}
              >
                Fill ranks 1..N
              </AppButton>
              <AppButton
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
                onClick={clearRanks}
                disabled={!eligible.length}
              >
                Clear
              </AppButton>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── Participant list ──────────────────────────────────── */}
      {shown.length === 0 ? (
        <GlassCard flat>
          <EmptyState
            icon={Users}
            title={participants.length === 0 ? 'No players joined this match' : 'No player matches this filter'}
            description={
              participants.length === 0
                ? 'Nobody booked a seat. Cancel & refund the match from the Matches screen.'
                : 'Clear the search or pick another filter.'
            }
          />
        </GlassCard>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((participant) => {
            const edit = edits[participant.userId] ?? EMPTY_EDIT;
            const paid = isPaid(participant);
            const banned = participant.isBanned || participant.accountBanned;
            const preview = previewOf(participant);
            const editable = payoutOpen && canPrize && !paid && !banned;
            const paidAmount = Number(participant.result?.prizeWon ?? 0);

            return (
              <li key={participant.userId}>
                <GlassCard
                  flat
                  className={`p-3.5 sm:p-4 ${banned ? 'border-rose-400/25' : paid ? 'border-emerald-400/20' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-300">
                          #{participant.slotNumber}
                        </span>
                        <p className="truncate text-[13px] font-black">{displayName(participant)}</p>
                        {paid && (
                          <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Paid {money(paidAmount)}
                          </span>
                        )}
                        {participant.isBanned && (
                          <span className="rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-300">
                            Match ban
                          </span>
                        )}
                        {participant.accountBanned && (
                          <span className="rounded-md border border-rose-400/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-600 dark:text-rose-300">
                            Account ban
                          </span>
                        )}
                        {edit.dq && (
                          <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">
                            DQ
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">
                        {participant.playerCode ?? '—'} • {participant.phoneNumber} • FF UID{' '}
                        <span className="font-mono text-slate-600 dark:text-slate-300">{participant.inGameUid ?? 'missing'}</span>
                      </p>

                      {participant.flags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {participant.flags.map((flag) => (
                            <span
                              key={flag.code}
                              title={flag.detail}
                              className={`rounded-md border px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide ${
                                flag.code === 'SAME_DEVICE' || flag.code === 'SAME_DEVICE_CROSS' || flag.code === 'ACCOUNT_BANNED'
                                  ? 'border-rose-400/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                                  : flag.code === 'NO_FF_UID' || flag.code === 'UID_MISMATCH'
                                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-300'
                                    : 'border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] text-slate-400'
                              }`}
                            >
                              {flag.code.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Reward</p>
                      <p className={`text-[14px] font-black ${banned ? 'text-slate-500 line-through' : paid ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                        {paid ? money(paidAmount) : money(preview)}
                      </p>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="mt-2.5 flex flex-wrap items-end gap-2">
                    <div className="w-[74px]">
                      <label className="mb-0.5 block text-[9px] font-black uppercase tracking-wider text-slate-500">Rank</label>
                      <TextInput
                        type="number"
                        min={1}
                        max={48}
                        inputMode="numeric"
                        value={edit.rank}
                        disabled={!editable}
                        placeholder="—"
                        onChange={(event) =>
                          update(participant.userId, {
                            rank: event.target.value.replace(/\D/g, '').slice(0, 2),
                          })
                        }
                        className="h-9 sm:h-9"
                      />
                    </div>
                    <div className="w-[74px]">
                      <label className="mb-0.5 block text-[9px] font-black uppercase tracking-wider text-slate-500">Kills</label>
                      <TextInput
                        type="number"
                        min={0}
                        max={99}
                        inputMode="numeric"
                        value={edit.kills}
                        disabled={!editable || edit.dq}
                        placeholder="0"
                        onChange={(event) =>
                          update(participant.userId, {
                            kills: event.target.value.replace(/\D/g, '').slice(0, 2),
                          })
                        }
                        className="h-9 sm:h-9"
                      />
                    </div>

                    {editable && (
                      <Chip
                        active={edit.dq}
                        onClick={() => update(participant.userId, { dq: !edit.dq })}
                        className="h-9"
                      >
                        Disqualify
                      </Chip>
                    )}

                    <div className="ml-auto flex gap-1.5">
                      {paid && <span className="text-[10px] font-bold text-emerald-400">Locked</span>}
                      {canPrize && (
                        <AppButton
                          size="sm"
                          variant={banned ? 'secondary' : 'danger'}
                          icon={<Ban className="h-3.5 w-3.5" />}
                          onClick={() => openBan(participant)}
                        >
                          {banned ? 'Manage ban' : 'Ban'}
                        </AppButton>
                      )}
                    </div>
                  </div>

                  {edit.dq && editable && (
                    <div className="mt-2">
                      <Field label="Disqualification reason" hint="Saved with the result (no prize is paid).">
                        <TextInput
                          value={edit.dqReason}
                          maxLength={255}
                          placeholder="e.g. teaming / hacking evidence"
                          onChange={(event) => update(participant.userId, { dqReason: event.target.value })}
                          className="h-9 sm:h-9"
                        />
                      </Field>
                    </div>
                  )}

                  {banned && (
                    <p className="mt-2 text-[10.5px] font-semibold text-rose-600 dark:text-rose-300">
                      Excluded from payout — unban first if this player should be paid.
                    </p>
                  )}
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Save panel ────────────────────────────────────────── */}
      <GlassCard flat className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[12px] font-black">
              Payout preview: <span className={overBudget ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}>{money(totalPreview)}</span>{' '}
              <span className="font-bold text-slate-500">of {money(pool)} pool</span>
            </p>
            <p className="mt-0.5 text-[10.5px] text-slate-400">
              {rankedCount} ranked • {unrankedCount} kills-only • {dqCount} DQ • {roster.summary.paid} already paid
              {roster.summary.banned > 0 ? ` • ${roster.summary.banned} banned (excluded)` : ''}
            </p>
            {overBudget && (
              <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                Preview is above the prize pool — lower ranks/kills before saving.
              </p>
            )}
            {!payoutOpen && (
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                Payout is closed for status {humanize(roster.match.status)}.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <AppButton
              variant="secondary"
              size="md"
              loading={saving === 'review'}
              disabled={!payoutOpen || !canPrize || !awards.length || overBudget || Boolean(saving)}
              onClick={() => setConfirm('review')}
            >
              Save results only
            </AppButton>
            <AppButton
              size="md"
              icon={<CheckCircle2 className="h-4 w-4" />}
              loading={saving === 'complete'}
              disabled={!payoutOpen || !canPrize || !awards.length || overBudget || Boolean(saving)}
              onClick={() => setConfirm('complete')}
            >
              Save results & complete match
            </AppButton>
          </div>
        </div>

        {!dirty && roster.summary.paid > 0 && (
          <div className="mt-3">
            <InfoNote>
              Already-paid players are locked and never paid twice — the server skips them even if a retry is
              sent.
            </InfoNote>
          </div>
        )}
      </GlassCard>

      {/* ── Confirm payout ────────────────────────────────────── */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'complete' ? 'Save results & complete this match?' : 'Save results without completing?'}
        description={
          confirm === 'complete'
            ? 'Verified kills and ranks are locked, every ranked player is paid from the prize pool, and the match becomes COMPLETED (it disappears from the players\' Live section immediately). This cannot be undone.'
            : 'Results are saved and prizes paid, but the match stays in its current status so you can keep editing.'
        }
        confirmLabel={confirm === 'complete' ? 'Yes, save & pay' : 'Save results'}
        busy={Boolean(saving)}
        danger={confirm === 'complete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void save(confirm)}
      >
        <div className="space-y-1.5 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-3 text-[12px]">
          <p className="flex justify-between">
            <span className="text-slate-500">Total to pay</span>
            <span className="font-black text-amber-600 dark:text-amber-300">{money(totalPreview)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Players</span>
            <span className="font-bold">{awards.length}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Ranked / kills-only / DQ</span>
            <span className="font-bold">
              {rankedCount} / {unrankedCount} / {dqCount}
            </span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Already paid (skipped)</span>
            <span className="font-bold">{roster.summary.paid}</span>
          </p>
          {actionError && (
            <p className="pt-1 text-[11px] font-bold text-rose-600 dark:text-rose-300">{actionError}</p>
          )}
        </div>
      </ConfirmDialog>

      {/* ── Payout summary ────────────────────────────────────── */}
      <FormDialog
        open={Boolean(payoutResult)}
        title="Results saved"
        description={
          payoutResult
            ? `${money(payoutResult.totalPaid)} paid to ${payoutResult.playersPaid} player(s). Match status: ${humanize(payoutResult.status)}.`
            : undefined
        }
        onClose={() => setPayoutResult(null)}
        footer={
          <AppButton onClick={() => setPayoutResult(null)}>Done</AppButton>
        }
      >
        {payoutResult && (
          <div className="space-y-2">
            {payoutResult.breakdown.length === 0 ? (
              <p className="text-[12px] text-slate-400">Everything was already paid — nothing new was credited.</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-white/[0.06] rounded-xl border border-slate-200 dark:border-white/10">
                {payoutResult.breakdown.map((row) => {
                  const participant = roster.participants.find((item) => item.userId === row.userId);
                  return (
                    <li key={row.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-[11.5px]">
                      <span className="min-w-0 truncate font-bold">
                        {participant ? displayName(participant) : row.userId}
                        {row.isDisqualified && <span className="ml-1 text-rose-600 dark:text-rose-300">(DQ)</span>}
                      </span>
                      <span className="shrink-0 font-black text-amber-600 dark:text-amber-300">{money(row.prizePaid)}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {payoutResult.skipped.length > 0 && (
              <p className="text-[11px] text-slate-400">
                Skipped: {payoutResult.skipped.length} (already paid — never paid twice).
              </p>
            )}
          </div>
        )}
      </FormDialog>

      {/* ── Ban dialog ────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(banTarget)}
        title={
          banTarget && (banTarget.isBanned || banTarget.accountBanned)
            ? `Manage ban — ${displayName(banTarget)}`
            : `Ban ${banTarget ? displayName(banTarget) : 'player'}`
        }
        description="Match ban only affects this match. Account ban logs the player out instantly on the next request (server-side session kill)."
        onClose={() => setBanTarget(null)}
        busy={banBusy}
        footer={
          banTarget && (banTarget.isBanned || banTarget.accountBanned) ? (
            <>
              <AppButton variant="secondary" onClick={() => setBanTarget(null)} disabled={banBusy}>
                Cancel
              </AppButton>
              <AppButton
                icon={<Undo2 className="h-4 w-4" />}
                loading={banBusy}
                onClick={() => void submitBan(false)}
              >
                Unban{banAccount ? ' account' : ' from match'}
              </AppButton>
            </>
          ) : (
            <>
              <AppButton variant="secondary" onClick={() => setBanTarget(null)} disabled={banBusy}>
                Cancel
              </AppButton>
              <AppButton
                variant="danger"
                icon={<Ban className="h-4 w-4" />}
                loading={banBusy}
                onClick={() => void submitBan(true)}
              >
                Ban player
              </AppButton>
            </>
          )
        }
      >
        <div className="space-y-3">
          <Field label="Reason" hint="Saved on the slot and shown to the owner.">
            <TextInput
              value={banReason}
              maxLength={255}
              placeholder="e.g. teaming in match 12"
              onChange={(event) => setBanReason(event.target.value)}
            />
          </Field>

          <Toggle
            checked={banAccount}
            onChange={setBanAccount}
            label="Ban the whole account"
            hint="Blocks the player from every match and kills their session instantly. Leave off for a match-only ban."
          />

          {actionError && <InlineError>{actionError}</InlineError>}
        </div>
      </FormDialog>
    </div>
  );
}
