import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  ClipboardCheck,
  Copy,
  Eye,
  History,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Swords,
  Trash2,
  Zap,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { can } from '../../lib/permissions';
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
import { formatCountdown, formatIST } from '../../lib/format';
import {
  isCancellable,
  isPayoutAllowed,
  matchHeadline,
  money,
  roomStateLabel,
  roomTone,
  seatsLabel,
  tabOf,
  visibilityLabel,
  type MatchTab,
} from '../../lib/matchUi';
import {
  draftFromIsoPlus,
  draftPreview,
  isDraftInFuture,
  scheduleToIso,
  shiftSchedule,
  type ScheduleDraft,
} from '../../lib/istTime';
import { Chip, Field, InlineError, TextInput } from './MatchFormBits';
import type { AdminTournament } from '../../types';

type BusyAction = 'visibility' | 'clone' | 'cancel' | null;

const TABS: Array<{ id: MatchTab; label: string; icon: typeof Zap }> = [
  { id: 'LIVE', label: 'Live', icon: Zap },
  { id: 'UPCOMING', label: 'Upcoming', icon: CalendarClock },
  { id: 'HISTORY', label: 'History', icon: History },
];

/**
 * Manage Matches — LIVE / UPCOMING / HISTORY with every lifecycle action the
 * Android admin app has: visibility window, clone, cancel + refund, room publish
 * jump and the manual lifecycle sweep.
 */
export function MatchesScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useSession();
  const { version } = useRealtime();

  const canCreate = can(user, 'canCreateMatch');
  const canRoom = can(user, 'canUpdateRoomId');

  const [items, setItems] = useState<AdminTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<MatchTab>('UPCOMING');
  const [search, setSearch] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [actionError, setActionError] = useState('');

  // dialogs
  const [visibilityTarget, setVisibilityTarget] = useState<AdminTournament | null>(null);
  const [visibilityAlways, setVisibilityAlways] = useState(true);
  const [visibilityHours, setVisibilityHours] = useState('10');

  const [cloneTarget, setCloneTarget] = useState<AdminTournament | null>(null);
  const [cloneSchedule, setCloneSchedule] = useState<ScheduleDraft>(() => draftFromIsoPlus(new Date().toISOString(), 1));

  const [cancelTarget, setCancelTarget] = useState<AdminTournament | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const list = await api.matches.listAll();
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (version > 0) void load(true);
  }, [version, load]);

  const counts = useMemo(() => {
    const result: Record<MatchTab, number> = { LIVE: 0, UPCOMING: 0, HISTORY: 0 };
    for (const match of items) result[tabOf(match.status)] += 1;
    return result;
  }, [items]);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = items.filter((match) => {
      if (tabOf(match.status) !== tab) return false;
      if (!query) return true;
      return [
        match.matchNumber != null ? String(match.matchNumber) : '',
        match.title,
        match.mapType,
        match.matchType,
        match.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return filtered.sort((a, b) => {
      const aTime = new Date(a.matchTime).getTime();
      const bTime = new Date(b.matchTime).getTime();
      return tab === 'HISTORY' ? bTime - aTime : aTime - bTime;
    });
  }, [items, tab, search]);

  const sweep = async () => {
    if (sweeping) return;
    setSweeping(true);
    setSweepNote('');
    try {
      const result = await api.matches.sweep();
      setSweepNote(
        `Sweep done • ${result.wentLive.length} match(es) went LIVE, ${result.movedToReview.length} moved to review`
      );
      toast.success(
        `${result.wentLive.length} LIVE • ${result.movedToReview.length} moved to review`
      );
      await load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  const openVisibility = (match: AdminTournament) => {
    setVisibilityTarget(match);
    setVisibilityAlways(match.visibilityHours == null);
    setVisibilityHours(String(match.visibilityHours ?? 10));
    setActionError('');
  };

  const saveVisibility = async () => {
    if (!visibilityTarget || busyId) return;
    const hours = Number(visibilityHours);
    if (!visibilityAlways && (!Number.isInteger(hours) || hours < 1 || hours > 336)) {
      setActionError('Enter 1 to 336 hours.');
      return;
    }

    setBusyId(visibilityTarget.id);
    setBusyAction('visibility');
    setActionError('');
    try {
      await api.matches.visibility(visibilityTarget.id, visibilityAlways ? null : hours);
      toast.success(visibilityAlways ? 'Match is listed for players now' : `Players see it only in the last ${hours}h`);
      setVisibilityTarget(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update visibility');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const openClone = (match: AdminTournament) => {
    setCloneTarget(match);
    setCloneSchedule(draftFromIsoPlus(match.matchTime, 1));
    setActionError('');
  };

  const saveClone = async () => {
    if (!cloneTarget || busyId) return;
    if (!isDraftInFuture(cloneSchedule)) {
      setActionError('Clone time must be in the future (IST).');
      return;
    }

    setBusyId(cloneTarget.id);
    setBusyAction('clone');
    setActionError('');
    try {
      const created = await api.matches.clone(cloneTarget.id, scheduleToIso(cloneSchedule));
      toast.success(
        `Cloned as ${created.matchNumber != null ? `#${created.matchNumber} ` : ''}${created.title}`
      );
      setCloneTarget(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not clone the match');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const openCancel = (match: AdminTournament) => {
    setCancelTarget(match);
    setCancelReason('');
    setActionError('');
  };

  const saveCancel = async () => {
    if (!cancelTarget || busyId) return;
    if (cancelReason.trim().length < 5) {
      setActionError('A cancellation reason is required (min 5 characters).');
      return;
    }

    setBusyId(cancelTarget.id);
    setBusyAction('cancel');
    setActionError('');
    try {
      const result = await api.matches.cancel(cancelTarget.id, cancelReason.trim());
      toast.success(`Cancelled — ${result.refundedPlayers} player(s), ${money(result.totalRefunded)} refunded`);
      setCancelTarget(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not cancel the match');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const dialogBusy = (id: string | null, action: BusyAction) => busyId === id && busyAction === action;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Phase 4 · Match operations"
        title="Matches"
        subtitle="Everything scheduled, live and finished — room state, visibility and lifecycle in one place."
        action={
          <>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </AppButton>
            {canCreate && (
              <AppButton size="sm" icon={<Zap className={sweeping ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />} loading={sweeping} onClick={() => void sweep()}>
                Sweep now
              </AppButton>
            )}
            {canCreate && (
              <AppButton size="sm" variant="cyan" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/matches/create')}>
                New match
              </AppButton>
            )}
          </>
        }
      />

      {sweepNote && (
        <p className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          {sweepNote}
        </p>
      )}
      {error && <InlineError>{error}</InlineError>}

      {/* ── Tabs + search ────────────────────────────────────────── */}
      <GlassCard flat className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-black transition-colors ${
                  tab === id
                    ? 'border-[#FFD000]/60 bg-[#FFD000]/15 text-amber-600 dark:text-amber-300'
                    : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span className="rounded-md bg-slate-200 dark:bg-black/25 px-1 text-[9px] font-black">
                  {counts[id]}
                </span>
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Match number, map, mode…"
              aria-label="Search matches"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-[12px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#FFD000]/70 dark:border-white/10 dark:bg-[#060B14] dark:text-white dark:placeholder:text-slate-600"
            />
          </div>
        </div>
      </GlassCard>

      {/* ── List ─────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingState rows={5} label="Loading matches…" />
      ) : shown.length === 0 ? (
        <GlassCard flat>
          <EmptyState
            icon={tab === 'HISTORY' ? History : tab === 'LIVE' ? Zap : CalendarClock}
            title={
              search
                ? 'No match matches that search'
                : tab === 'LIVE'
                  ? 'No live matches right now'
                  : tab === 'UPCOMING'
                    ? 'No upcoming matches'
                    : 'No past matches yet'
            }
            description={
              search
                ? 'Clear the search or switch tabs.'
                : tab === 'UPCOMING'
                  ? 'Create a match to open entries. Visibility and room publish are handled after creation.'
                  : tab === 'LIVE'
                    ? 'Matches flip to LIVE automatically at kickoff, or press "Sweep now".'
                    : 'Completed and cancelled matches will be listed here with their settlement notes.'
            }
            action={
              !search && tab !== 'HISTORY' && canCreate ? (
                <AppButton size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/matches/create')}>
                  Create match
                </AppButton>
              ) : undefined
            }
          />
        </GlassCard>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((match) => {
            const room = roomTone(match);
            const payoutReady = isPayoutAllowed(match.status);
            const cancellable = isCancellable(match.status);

            return (
              <li key={match.id}>
                <GlassCard flat className="p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-black">{matchHeadline(match)}</p>
                        <StatusBadge status={match.status} />
                        {match.status === 'UNDER_REVIEW' && (
                          <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">
                            Results pending
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatIST(match.matchTime)} • {formatCountdown(match.matchTime)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[12px] font-black">
                        ₹{Number(match.prizePool)} <span className="text-[10px] font-bold text-slate-500">pool</span>
                      </p>
                      <p className="text-[10.5px] text-slate-400">
                        ₹{Number(match.entryFee)} entry • ₹{Number(match.perKillPrize ?? 0)}/kill
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="rounded-md border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                      {seatsLabel(match)}
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 ${
                        match.isListedNow === false
                          ? 'border-slate-500/30 bg-slate-500/10 text-slate-400'
                          : 'border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-700 dark:text-cyan-300'
                      }`}
                      title={visibilityLabel(match)}
                    >
                      👁 {match.isListedNow === false ? visibilityLabel(match) : 'Listed now'}
                    </span>
                    <span
                      className={`rounded-md border px-1.5 py-0.5 ${
                        room === 'live'
                          ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-700 dark:text-emerald-300'
                          : room === 'hidden'
                            ? 'border-amber-400/25 bg-amber-400/[0.07] text-amber-600 dark:text-amber-300'
                            : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] text-slate-400'
                      }`}
                    >
                      {room === 'live' ? '🔑 Room live' : room === 'hidden' ? '🔑 Room hidden' : '🔑 No room'}
                    </span>
                    {match.roomRevealedAt && (
                      <span className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.05] px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                        Revealed {formatIST(match.roomRevealedAt)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-[10.5px] text-slate-500">{roomStateLabel(match)}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {payoutReady && (
                      <AppButton
                        size="sm"
                        variant={match.status === 'LIVE' ? 'primary' : 'secondary'}
                        icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                        onClick={() => navigate(`/matches/${match.id}`)}
                      >
                        {match.status === 'LIVE' ? 'End & score' : 'Open roster'}
                      </AppButton>
                    )}
                    {canRoom && (
                      <AppButton
                        size="sm"
                        variant="secondary"
                        icon={<Radio className="h-3.5 w-3.5" />}
                        onClick={() => navigate(`/matches/publish?match=${match.id}`)}
                      >
                        Publish room
                      </AppButton>
                    )}
                    {canCreate && match.status !== 'CANCELLED' && (
                      <AppButton
                        size="sm"
                        variant="ghost"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => openVisibility(match)}
                      >
                        Visibility
                      </AppButton>
                    )}
                    {canCreate && (
                      <AppButton
                        size="sm"
                        variant="ghost"
                        icon={<Copy className="h-3.5 w-3.5" />}
                        onClick={() => openClone(match)}
                      >
                        Clone
                      </AppButton>
                    )}
                    {canCreate && cancellable && (
                      <AppButton
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => openCancel(match)}
                      >
                        Cancel & refund
                      </AppButton>
                    )}
                    {match.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <Swords className="h-3 w-3" /> Done — paid via roster
                      </span>
                    )}
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Visibility dialog ───────────────────────────────────── */}
      <FormDialog
        open={Boolean(visibilityTarget)}
        title="Player list visibility"
        description={
          visibilityTarget
            ? `${visibilityTarget.title} — ${formatIST(visibilityTarget.matchTime)}`
            : undefined
        }
        onClose={() => setVisibilityTarget(null)}
        busy={dialogBusy(visibilityTarget?.id ?? null, 'visibility')}
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setVisibilityTarget(null)} disabled={busyId === visibilityTarget?.id}>
              Cancel
            </AppButton>
            <AppButton
              onClick={() => void saveVisibility()}
              loading={dialogBusy(visibilityTarget?.id ?? null, 'visibility')}
            >
              Save visibility
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={visibilityAlways} onClick={() => setVisibilityAlways(true)}>
              Always visible
            </Chip>
            <Chip active={!visibilityAlways} onClick={() => setVisibilityAlways(false)}>
              Only near start
            </Chip>
          </div>

          {!visibilityAlways && (
            <>
              <Field label="Show in list this many hours before start" hint="Between 1 and 336 hours.">
                <TextInput
                  inputMode="numeric"
                  value={visibilityHours}
                  onChange={(event) => setVisibilityHours(event.target.value.replace(/\D/g, '').slice(0, 3))}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {['2', '6', '10', '12', '24'].map((preset) => (
                  <Chip key={preset} active={visibilityHours === preset} onClick={() => setVisibilityHours(preset)}>
                    {preset}h
                  </Chip>
                ))}
              </div>
              {visibilityTarget && Number(visibilityHours) >= 1 && Number(visibilityHours) <= 336 && (
                <p className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11px] text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/[0.06] dark:text-cyan-200">
                  Players see it from{' '}
                  <b>
                    {formatIST(
                      new Date(
                        new Date(visibilityTarget.matchTime).getTime() - Number(visibilityHours) * 3_600_000
                      ).toISOString()
                    )}
                  </b>
                </p>
              )}
            </>
          )}

          {actionError && <InlineError>{actionError}</InlineError>}
        </div>
      </FormDialog>

      {/* ── Clone dialog ────────────────────────────────────────── */}
      <FormDialog
        open={Boolean(cloneTarget)}
        title="Clone match"
        description={
          cloneTarget
            ? `Copies map, mode, entry, prizes and visibility settings from ${cloneTarget.title}. A fresh match number is assigned.`
            : undefined
        }
        onClose={() => setCloneTarget(null)}
        busy={dialogBusy(cloneTarget?.id ?? null, 'clone')}
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setCloneTarget(null)} disabled={busyId === cloneTarget?.id}>
              Cancel
            </AppButton>
            <AppButton
              icon={<Copy className="h-4 w-4" />}
              onClick={() => void saveClone()}
              loading={dialogBusy(cloneTarget?.id ?? null, 'clone')}
            >
              Clone match
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip onClick={() => setCloneSchedule((draft) => shiftSchedule(draft, 1))}>+1 hour</Chip>
            <Chip onClick={() => setCloneSchedule((draft) => shiftSchedule(draft, 3))}>+3 hours</Chip>
            <Chip onClick={() => setCloneSchedule((draft) => shiftSchedule(draft, 24))}>+1 day</Chip>
            {cloneTarget && (
              <Chip onClick={() => setCloneSchedule(draftFromIsoPlus(cloneTarget.matchTime, 1))}>Original +1h</Chip>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New date (IST)">
              <TextInput
                type="date"
                value={cloneSchedule.date}
                onChange={(event) => setCloneSchedule((draft) => ({ ...draft, date: event.target.value }))}
              />
            </Field>
            <Field label="Kickoff (IST)">
              <div className="flex items-center gap-1.5">
                <TextInput
                  aria-label="Hour"
                  type="number"
                  min={1}
                  max={12}
                  value={cloneSchedule.hour12}
                  onChange={(event) =>
                    setCloneSchedule((draft) => ({
                      ...draft,
                      hour12: Math.min(12, Math.max(1, Number(event.target.value) || 12)),
                    }))
                  }
                />
                <TextInput
                  aria-label="Minute"
                  type="number"
                  min={0}
                  max={59}
                  value={cloneSchedule.minute}
                  onChange={(event) =>
                    setCloneSchedule((draft) => ({
                      ...draft,
                      minute: Math.min(59, Math.max(0, Number(event.target.value) || 0)),
                    }))
                  }
                />
                <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                  {(['AM', 'PM'] as const).map((meridiem) => (
                    <button
                      key={meridiem}
                      type="button"
                      onClick={() => setCloneSchedule((draft) => ({ ...draft, meridiem }))}
                      className={`h-11 px-2 text-[11px] font-black sm:h-10 ${
                        cloneSchedule.meridiem === meridiem
                          ? 'bg-[#FFD000] text-slate-950'
                          : 'text-slate-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {meridiem}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
          </div>

          <p className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] px-3 py-2 text-[11px] text-slate-400">
            New kickoff: <b className="text-slate-950 dark:text-white">{draftPreview(cloneSchedule)} IST</b> •{' '}
            {isDraftInFuture(cloneSchedule) ? `starts in ${formatCountdown(scheduleToIso(cloneSchedule))}` : 'must be in the future'}
          </p>

          {actionError && <InlineError>{actionError}</InlineError>}
        </div>
      </FormDialog>

      {/* ── Cancel & refund ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel match & refund everyone?"
        description={
          cancelTarget
            ? `${cancelTarget.title} — ${formatIST(cancelTarget.matchTime)}. Every seated player is refunded ₹${Number(cancelTarget.entryFee)} to the balance they paid from. This cannot be undone.`
            : undefined
        }
        confirmLabel="Cancel & refund all"
        danger
        busy={dialogBusy(cancelTarget?.id ?? null, 'cancel')}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void saveCancel()}
      >
        <div className="space-y-2">
          <Field label="Cancellation reason" hint="Minimum 5 characters — shown to players in the ledger.">
            <TextInput
              value={cancelReason}
              placeholder="e.g. Not enough players — cancelled by organiser"
              onChange={(event) => setCancelReason(event.target.value.slice(0, 300))}
            />
          </Field>
          {actionError && <InlineError>{actionError}</InlineError>}
          <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {cancelTarget ? `${cancelTarget.slotsBooked} player(s) will be refunded and notified.` : ''}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
