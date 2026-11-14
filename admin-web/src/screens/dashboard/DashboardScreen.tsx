import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Coins,
  KeyRound,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet as WalletIcon,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { can, isOwner, NAV_GROUPS } from '../../lib/permissions';
import { useTheme } from '../../lib/theme';
import {
  cx,
  formatCountdown,
  formatINR,
  formatINRCompact,
  formatISTLong,
  formatISTTime,
  humanize,
  initialsOf,
  isTodayIST,
  relativeToNow,
} from '../../lib/format';
import { useSession } from '../../context/SessionContext';
import { useRealtime } from '../../context/RealtimeContext';
import type { AdminTournament, DashboardSnapshot, PaymentsSummary } from '../../types';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { StatPill } from '../../components/common/StatPill';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { AppButton } from '../../components/common/AppButton';
import { RoleBadge } from '../../components/common/RoleBadge';

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  liveMatches: 0,
  upcomingMatches: 0,
  slotsBookedToday: 0,
  pendingWithdrawals: 0,
  pendingWithdrawalsAmount: 0,
  pendingDeposits: 0,
  pendingDepositsAmount: 0,
  collectedToday: 0,
  pendingOnline: 0,
  demoPayments: false,
  watchlistAlerts: 0,
  suspiciousPlayers: 0,
};

const MODULE_META: Record<
  string,
  { description: string; icon: typeof Sparkles; accent: 'gold' | 'cyan' | 'emerald' | 'rose' | 'slate' }
> = {
  '/matches': { description: 'All matches, room state and lifecycle actions', icon: CalendarClock, accent: 'cyan' },
  '/matches/create': { description: 'Map, mode, slots, entry fee and IST schedule', icon: Sparkles, accent: 'gold' },
  '/matches/publish': { description: 'Room ID + password and reveal windows', icon: Radio, accent: 'cyan' },
  '/roster': { description: 'Per-player ranks, kills, DQ and prize payout', icon: ClipboardCheck, accent: 'emerald' },
  '/wallet': { description: 'Deposits, withdrawal UTRs and online payments', icon: WalletIcon, accent: 'gold' },
  '/wallet/settlement': { description: 'Daily P&L, ledger and CSV export', icon: Coins, accent: 'emerald' },
  '/players': { description: 'Search, history, bans and anti-cheat signals', icon: Users, accent: 'cyan' },
  '/staff': { description: 'Permission keys, revoke and regenerate', icon: KeyRound, accent: 'gold' },
  '/settings': { description: 'UPI, support number and login toggles', icon: ShieldCheck, accent: 'slate' },
};

/**
 * Dashboard — "aaj ka kaam" first, modules second.
 *
 * The KPI strip loads only what the signed-in role may see: staff without
 * `canManageWallet` never call the wallet endpoints, so the console does not
 * spam 403s and cannot leak money figures into a read-only session.
 */
export function DashboardScreen() {
  const isDark = useTheme() === 'dark';
  const navigate = useNavigate();
  const { user } = useSession();
  const { version } = useRealtime();

  const owner = isOwner(user);
  const walletAccess = can(user, 'canManageWallet');

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [tournaments, setTournaments] = useState<AdminTournament[]>([]);
  const [payments, setPayments] = useState<PaymentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletError, setWalletError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setWalletError('');
    setLoading(true);

    const next: DashboardSnapshot = { ...EMPTY_SNAPSHOT };

    try {
      const list = await api.matches.list({ limit: 50 });
      const items = list.items ?? [];
      setTournaments(items);
      next.liveMatches = items.filter((item) => item.status === 'LIVE').length;
      next.upcomingMatches = items.filter((item) =>
        ['UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'].includes(item.status)
      ).length;
      next.slotsBookedToday = items
        .filter((item) => isTodayIST(item.matchTime))
        .reduce((sum, item) => sum + (item.slotsBooked ?? 0), 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load matches');
      setLoading(false);
      return;
    }

    if (walletAccess) {
      try {
        const [withdrawals, deposits, online] = await Promise.all([
          api.wallet.withdrawals('PENDING'),
          api.wallet.deposits('PENDING'),
          api.wallet.payments({ status: 'ALL', limit: 5 }),
        ]);

        next.pendingWithdrawals = withdrawals.withdrawals.length;
        next.pendingWithdrawalsAmount = withdrawals.withdrawals.reduce(
          (sum, row) => sum + Number(row.amount),
          0
        );
        next.pendingDeposits = deposits.deposits.length;
        next.pendingDepositsAmount = deposits.pendingTotal ?? 0;
        next.collectedToday = online.summary.collectedTodayRupees;
        next.pendingOnline = online.summary.pendingCount;
        next.demoPayments = online.summary.demoMode;
        setPayments(online.summary);
      } catch (err) {
        setWalletError(err instanceof ApiError ? err.message : 'Wallet data unavailable');
        setPayments(null);
      }
    }

    if (owner) {
      try {
        const watchlist = await api.players.watchlist();
        next.watchlistAlerts = watchlist.totalAlerts ?? 0;
      } catch {
        next.watchlistAlerts = 0;
      }
    }

    setSnapshot(next);
    setLoading(false);
  }, [walletAccess, owner]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const nextMatch = useMemo(() => {
    const upcoming = tournaments
      .filter((item) => ['UPCOMING', 'OPEN', 'SLOTS_FULL', 'ROOM_REVEALED'].includes(item.status))
      .sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime());
    return upcoming[0] ?? null;
  }, [tournaments]);

  const liveMatches = useMemo(
    () => tournaments.filter((item) => item.status === 'LIVE').slice(0, 3),
    [tournaments]
  );

  const modules = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) =>
        group.items
          .filter((item) => item.to !== '/' && can(user, item.access))
          .map((item) => ({ ...item, group: group.label }))
      ),
    [user]
  );

  const ownerModules = modules.filter((item) => item.group === 'Owner controls');
  const staffModules = modules.filter((item) => item.group !== 'Owner controls');

  const greeting = (() => {
    const hour = Number(
      new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(
        new Date()
      )
    );
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cx('text-[10px] font-black uppercase tracking-[0.2em]', isDark ? 'text-cyan-400/80' : 'text-cyan-700')}>
            {formatISTLong()}
          </p>
          <h2 className={cx('mt-1 font-display text-xl font-black tracking-tight sm:text-2xl', isDark ? 'text-white' : 'text-slate-950')}>
            {greeting}, {user?.name?.split(' ')[0] ?? 'Admin'}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RoleBadge user={user} />
            <span className={cx('text-[11px]', isDark ? 'text-slate-500' : 'text-slate-500')}>
              {owner ? 'Every module unlocked' : `${countPermissions(user)} of 4 staff permissions`}
            </span>
            {snapshot.demoPayments && (
              <span className={cx('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider', isDark ? 'border-amber-400/30 text-amber-300' : 'border-amber-300 bg-amber-50 text-amber-700')}>
                Mock gateway
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </AppButton>
        </div>
      </div>

      {error && (
        <GlassCard className={cx('flex flex-wrap items-center justify-between gap-3 p-4', isDark ? 'border-rose-400/25' : 'border-rose-200')}>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p className={cx('text-xs font-black', isDark ? 'text-rose-200' : 'text-rose-700')}>Dashboard data failed</p>
              <p className={cx('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{error}</p>
            </div>
          </div>
          <AppButton variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </AppButton>
        </GlassCard>
      )}

      {/* ── KPI strip ────────────────────────────────────────────────── */}
      <section aria-label="Aaj ka kaam">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          <StatPill
            label="Live matches"
            hint={snapshot.liveMatches ? 'Scoring window open' : 'No match is live'}
            value={String(snapshot.liveMatches)}
            icon={Activity}
            tone="rose"
            loading={loading}
            onClick={can(user, 'canDistributePrize') ? () => navigate('/roster') : undefined}
          />
          <StatPill
            label="Pending withdrawals"
            hint={
              snapshot.pendingWithdrawals
                ? `${formatINR(Math.round(snapshot.pendingWithdrawalsAmount))} queued`
                : 'Queue clear'
            }
            value={String(snapshot.pendingWithdrawals)}
            icon={Banknote}
            tone="gold"
            loading={loading}
            onClick={walletAccess ? () => navigate('/wallet') : undefined}
          />
          <StatPill
            label="Pending deposits"
            hint={
              snapshot.pendingDeposits
                ? `${formatINR(Math.round(snapshot.pendingDepositsAmount))} to verify`
                : walletError || 'Nothing to verify'
            }
            value={walletAccess ? String(snapshot.pendingDeposits) : '—'}
            icon={Coins}
            tone="cyan"
            loading={loading}
            onClick={walletAccess ? () => navigate('/wallet') : undefined}
          />
          <StatPill
            label="Collected today"
            hint={payments ? `${payments.capturedCount} captured · ${snapshot.pendingOnline} pending` : 'Online payments'}
            value={walletAccess ? formatINRCompact(snapshot.collectedToday) : '—'}
            icon={WalletIcon}
            tone="emerald"
            loading={loading}
            onClick={walletAccess ? () => navigate('/wallet') : undefined}
          />
          <StatPill
            label="Alerts"
            hint={owner ? 'Watchlist + suspicious' : 'Owner-only signals'}
            value={owner ? String(snapshot.watchlistAlerts) : '—'}
            icon={ShieldAlert}
            tone="slate"
            loading={loading}
            className="col-span-2 sm:col-span-1"
            onClick={owner ? () => navigate('/players') : undefined}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Modules ────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <section>
            <SectionHeader
              eyebrow="Modules"
              title="Operations & money"
              subtitle="Only the screens your role can use are shown."
            />
            {loading && !modules.length ? (
              <LoadingState className="mt-3" label="Loading modules…" rows={3} />
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {staffModules.map((item) => (
                  <ModuleCard
                    key={item.to}
                    icon={MODULE_META[item.to]?.icon ?? Sparkles}
                    label={item.label}
                    description={MODULE_META[item.to]?.description ?? ''}
                    accent={MODULE_META[item.to]?.accent ?? 'slate'}
                    phase={item.phase}
                    onOpen={() => navigate(item.to)}
                  />
                ))}
              </div>
            )}
          </section>

          {ownerModules.length > 0 && (
            <section>
              <SectionHeader
                eyebrow="Owner controls"
                title="Staff, players & settings"
                subtitle="Visible to the owner account only."
              />
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {ownerModules.map((item) => (
                  <ModuleCard
                    key={item.to}
                    icon={MODULE_META[item.to]?.icon ?? Sparkles}
                    label={item.label}
                    description={MODULE_META[item.to]?.description ?? ''}
                    accent={MODULE_META[item.to]?.accent ?? 'gold'}
                    phase={item.phase}
                    onOpen={() => navigate(item.to)}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          {!owner && !can(user, 'canManageWallet') && !can(user, 'canCreateMatch') && !can(user, 'canDistributePrize') && (
            <GlassCard className="flex items-start gap-2.5 p-4">
              <ShieldCheck className={cx('mt-0.5 h-4 w-4 shrink-0', isDark ? 'text-slate-400' : 'text-slate-500')} />
              <div>
                <p className={cx('text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>Read-only staff session</p>
                <p className={cx('mt-0.5 text-[11px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  No permissions assigned yet. Owner se bolo ki Staff &amp; Access screen se permissions on kare.
                </p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* ── Match day panel ────────────────────────────────────────── */}
        <div className="space-y-3">
          <SectionHeader eyebrow="Match day" title="Live & next up" />

          <GlassCard className="overflow-hidden">
            {loading ? (
              <LoadingState className="p-3" rows={2} label="Loading matches…" />
            ) : liveMatches.length === 0 && !nextMatch ? (
              <EmptyState
                icon={CalendarClock}
                title="No matches scheduled"
                description="Create a match to open the player feed and start taking slots."
                action={
                  can(user, 'canCreateMatch') ? (
                    <AppButton size="sm" onClick={() => navigate('/matches/create')}>
                      Create match
                    </AppButton>
                  ) : undefined
                }
              />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {liveMatches.map((match) => (
                  <MatchRow key={match.id} match={match} onOpen={() => navigate('/matches')} />
                ))}
                {nextMatch && (
                  <div className={cx('p-3.5', isDark ? 'bg-white/[0.02]' : 'bg-slate-50/70')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cx('text-[10px] font-black uppercase tracking-wider', isDark ? 'text-amber-300' : 'text-amber-700')}>
                        Next up
                      </p>
                      <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {relativeToNow(nextMatch.matchTime)}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <MatchRow match={nextMatch} onOpen={() => navigate('/matches')} bare />
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className={cx('text-xs font-black', isDark ? 'text-white' : 'text-slate-950')}>Day snapshot</p>
              <span className={cx('text-[10px] font-bold', isDark ? 'text-slate-500' : 'text-slate-500')}>
                {formatISTTime(new Date())} IST
              </span>
            </div>
            <dl className="mt-3 space-y-2">
              {[
                { label: 'Upcoming matches', value: String(snapshot.upcomingMatches) },
                { label: 'Slots booked today', value: String(snapshot.slotsBookedToday) },
                {
                  label: 'Withdrawal queue',
                  value: walletAccess ? formatINR(Math.round(snapshot.pendingWithdrawalsAmount)) : '—',
                },
                {
                  label: 'Deposit queue',
                  value: walletAccess ? formatINR(Math.round(snapshot.pendingDepositsAmount)) : '—',
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className={cx('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{row.label}</dt>
                  <dd className={cx('font-mono text-[11px] font-bold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </GlassCard>

          {walletError && (
            <p className={cx('px-1 text-[10px]', isDark ? 'text-amber-300/80' : 'text-amber-700')}>
              {walletError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function countPermissions(user: ReturnType<typeof useSession>['user']): number {
  if (!user) return 0;
  return Object.values(user.permissions ?? {}).filter(Boolean).length;
}

function MatchRow({
  match,
  onOpen,
  bare = false,
}: {
  match: AdminTournament;
  onOpen: () => void;
  bare?: boolean;
}) {
  const isDark = useTheme() === 'dark';

  return (
    <div className={cx('flex items-center gap-3', bare ? '' : 'p-3.5')}>
      <div
        className={cx(
          'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border',
          isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'
        )}
      >
        <span className={cx('font-mono text-[11px] font-black', isDark ? 'text-white' : 'text-slate-900')}>
          {formatISTTime(match.matchTime).replace(' ', '').slice(0, 5)}
        </span>
        <span className={cx('text-[8px] font-bold uppercase', isDark ? 'text-slate-500' : 'text-slate-400')}>IST</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cx('truncate text-[12px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
            {match.matchNumber ? `#${match.matchNumber}` : humanize(match.mapType)} · {humanize(match.matchType)}
          </p>
          <StatusBadge status={match.status} />
        </div>
        <p className={cx('mt-0.5 truncate text-[10px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
          {match.slotsBooked}/{match.totalSlots} slots · {formatINR(Number(match.entryFee))} entry ·{' '}
          {formatINR(Number(match.prizePool))} pool
          {match.status !== 'LIVE' ? ` · ${formatCountdown(match.matchTime)} left` : ''}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        aria-label="Open matches"
        className={cx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95',
          isDark
            ? 'border-white/10 bg-white/[0.03] text-slate-300 hover:text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950'
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  label,
  description,
  accent,
  phase,
  onOpen,
  compact = false,
}: {
  icon: typeof Sparkles;
  label: string;
  description: string;
  accent: 'gold' | 'cyan' | 'emerald' | 'rose' | 'slate';
  phase?: 4 | 5;
  onOpen: () => void;
  compact?: boolean;
}) {
  const isDark = useTheme() === 'dark';

  const accents = {
    gold: isDark ? 'text-amber-300 bg-amber-400/10 border-amber-400/20' : 'text-amber-700 bg-amber-50 border-amber-200',
    cyan: isDark ? 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20' : 'text-cyan-700 bg-cyan-50 border-cyan-200',
    emerald: isDark ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200',
    rose: isDark ? 'text-rose-300 bg-rose-400/10 border-rose-400/20' : 'text-rose-700 bg-rose-50 border-rose-200',
    slate: isDark ? 'text-slate-300 bg-white/[0.06] border-white/10' : 'text-slate-700 bg-slate-100 border-slate-200',
  } as const;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'group flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99]',
        isDark
          ? 'border-white/[0.08] bg-[#0C121E]/85 backdrop-blur-xl hover:border-white/20'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300',
        compact && 'sm:flex-col sm:items-start'
      )}
    >
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', accents[accent])}>
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cx('truncate text-[12.5px] font-black', isDark ? 'text-white' : 'text-slate-950')}>
            {label}
          </span>
          {phase && (
            <span
              className={cx(
                'shrink-0 rounded-md border px-1 py-0.5 text-[8px] font-black uppercase tracking-wider',
                isDark ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'
              )}
            >
              Phase {phase}
            </span>
          )}
        </span>
        {description && (
          <span className={cx('mt-0.5 block text-[10.5px] leading-snug', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {description}
          </span>
        )}
      </span>

      <ArrowUpRight
        className={cx(
          'h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5',
          isDark ? 'text-slate-500' : 'text-slate-400'
        )}
      />
    </button>
  );
}

/** Avatar chip used by future player lists — exported so Phase 5 reuses it. */
export function Avatar({ name, className }: { name: string | null; className?: string }) {
  const isDark = useTheme() === 'dark';
  return (
    <span
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black',
        isDark ? 'border-white/10 bg-white/[0.05] text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-700',
        className
      )}
    >
      {initialsOf(name, 'P')}
    </span>
  );
}
