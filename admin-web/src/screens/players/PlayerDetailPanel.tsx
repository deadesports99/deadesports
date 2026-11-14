import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Flag,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatINR, formatIST, humanize } from '../../lib/format';
import { Chip, InlineError } from '../matches/MatchFormBits';
import type { PlayerDetail, PlayerHistoryRow } from '../../types';

type HistoryFilter = 'all' | 'paid' | 'flagged';

function playerTitle(detail: PlayerDetail): string {
  return detail.player.inGameName || detail.player.name || detail.player.phoneNumber;
}

export function PlayerDetailPanel({
  playerId,
  onClose,
  onChanged,
  onOpenPlayer,
  onOpenMatch,
}: {
  playerId: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenPlayer: (id: string) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const toast = useToast();

  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [banOpen, setBanOpen] = useState(false);
  const [banning, setBanning] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setDetail(await api.players.detail(playerId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this player');
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    setDetail(null);
    setFilter('all');
    void load();
  }, [load]);

  const rows = useMemo<PlayerHistoryRow[]>(() => {
    const matches = detail?.history.matches ?? [];
    if (filter === 'all') return matches;
    if (filter === 'paid') return matches.filter((m) => m.isPaid);
    return matches.filter(
      (m) => m.isDisqualified || m.bannedFromMatch || m.sharedDeviceInMatch || m.status === 'UNDER_REVIEW'
    );
  }, [detail, filter]);

  const setBanned = async () => {
    if (!detail || banning) return;
    setBanning(true);
    setActionError('');
    try {
      const next = !detail.player.isBanned;
      await api.players.setBanned(detail.player.id, next);
      toast.success(next ? 'Player banned — sessions invalidated' : 'Player unbanned');
      setBanOpen(false);
      await load(true);
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the ban state');
    } finally {
      setBanning(false);
    }
  };

  const watchDevice = async () => {
    if (!detail?.player.deviceId || watchBusy) return;
    setWatchBusy(true);
    setActionError('');
    try {
      await api.players.watch(detail.player.deviceId, `Flagged from ${playerTitle(detail)}`);
      toast.success('Device added to the watchlist');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not watch this device');
    } finally {
      setWatchBusy(false);
    }
  };

  if (loading) {
    return (
      <GlassCard className="p-4">
        <LoadingState label="Loading player profile…" />
      </GlassCard>
    );
  }

  if (error || !detail) {
    return (
      <GlassCard className="p-4">
        <EmptyState
          icon={Users}
          title="Player not loaded"
          description={error || 'The profile could not be fetched.'}
          action={
            <div className="flex gap-2">
              <AppButton size="sm" variant="secondary" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onClose}>
                Back
              </AppButton>
              <AppButton size="sm" onClick={() => void load()}>
                Try again
              </AppButton>
            </div>
          }
        />
      </GlassCard>
    );
  }

  const p = detail.player;
  const career = detail.history.summary;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-950 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All players
      </button>

      <SectionHeader
        eyebrow="Player profile"
        title={playerTitle(detail)}
        subtitle={`${p.playerCode ?? 'No code'} · ${p.phoneNumber} · joined ${formatIST(p.createdAt)} · ${
          p.accountAgeDays
        } day(s) old`}
        action={
          <>
            {p.playerCode && (
              <span className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-[10px] font-black text-slate-500 dark:border-white/10">
                {p.playerCode}
              </span>
            )}
            <StatusBadge status={p.isBanned ? 'REJECTED' : 'APPROVED'} label={p.isBanned ? 'Banned' : 'Active'} />
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void load()}
            >
              Refresh
            </AppButton>
            <AppButton
              size="sm"
              variant={p.isBanned ? 'primary' : 'danger'}
              icon={p.isBanned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              onClick={() => {
                setActionError('');
                setBanOpen(true);
              }}
            >
              {p.isBanned ? 'Unban' : 'Ban'}
            </AppButton>
          </>
        }
      />

      {actionError && <InlineError>{actionError}</InlineError>}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { label: 'Deposit balance', value: formatINR(Number(p.depositBalance), 2), icon: Wallet },
          { label: 'Winnings', value: formatINR(Number(p.winningBalance), 2), icon: Trophy },
          { label: 'Lifetime winnings', value: formatINR(Number(p.totalWinnings), 2), icon: Trophy },
          { label: 'Entry fees spent', value: formatINR(Number(p.totalSpentOnEntries), 2), icon: Swords },
          { label: 'Total deposited', value: formatINR(Number(p.totalDeposited), 2), icon: Wallet },
          { label: 'Total withdrawn', value: formatINR(Number(p.totalWithdrawn), 2), icon: Wallet },
          { label: 'Matches joined', value: String(p.matchesJoined), icon: Users },
          { label: 'Win rate', value: `${career.winRatePct}%`, icon: Trophy },
        ].map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} flat className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1 text-[14.5px] font-black leading-none">{value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <GlassCard className="p-4 lg:col-span-2">
          <SectionHeader
            title="Career & match history"
            subtitle={`${career.completedMatches} completed · ${career.totalKills} kills · avg ${
              career.avgKills
            }/match · ${career.booyahs} Booyah`}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { id: 'all', label: `All ${detail.history.matches.length}` },
              { id: 'paid', label: `Paid ${detail.history.matches.filter((m) => m.isPaid).length}` },
              {
                id: 'flagged',
                label: `Flagged ${
                  detail.history.matches.filter(
                    (m) => m.isDisqualified || m.bannedFromMatch || m.sharedDeviceInMatch || m.status === 'UNDER_REVIEW'
                  ).length
                }`,
              },
            ] as Array<{ id: HistoryFilter; label: string }>).map((f) => (
              <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Flag}
              title={filter === 'all' ? 'No matches yet' : 'Nothing matches this filter'}
              description={filter === 'all' ? 'This player has not joined a match.' : undefined}
            />
          ) : (
            <ul className="mt-2 divide-y divide-slate-200 dark:divide-white/[0.06]">
              {rows.map((m) => (
                <li key={m.tournamentId} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={() => onOpenMatch(m.tournamentId)}
                      className="text-[12px] font-black hover:underline"
                      title="Open the match roster"
                    >
                      #{m.matchNumber ?? '—'} {humanize(m.mapType)} • {humanize(m.matchType)}
                    </button>
                    <StatusBadge status={m.status} />
                    {m.isDisqualified && <StatusBadge status="REJECTED" label="DQ" />}
                    {m.bannedFromMatch && <StatusBadge status="REJECTED" label="Match ban" />}
                    {m.sharedDeviceInMatch && <StatusBadge status="UNDER_REVIEW" label="Shared device" />}
                    <span className="ml-auto text-[10.5px] text-slate-500">
                      {formatIST(m.matchTime)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">
                    {m.inGameNameAtJoin ?? '—'} · UID {m.inGameUidAtJoin ?? '—'} · slot {m.slotNumber} ·{' '}
                    {m.rank ? `rank ${m.rank}` : 'no rank'} · {m.kills} kills ·{' '}
                    {m.isPaid ? (
                      <b className="text-emerald-700 dark:text-emerald-300">{formatINR(Number(m.prizeWon), 2)} paid</b>
                    ) : Number(m.prizeWon) > 0 ? (
                      <b>{formatINR(Number(m.prizeWon), 2)} unclaimed</b>
                    ) : (
                      'no prize'
                    )}
                    {m.disqualifyReason ? ` · ${m.disqualifyReason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <div className="space-y-3">
          <GlassCard className="p-4">
            <SectionHeader title="Cheat signals" subtitle="Derived from slots, results and the ledger." />
            <ul className="mt-2 space-y-1.5 text-[11px]">
              {[
                { label: 'Avg kills', value: String(career.avgKills) },
                { label: 'Disqualifications', value: String(career.disqualifications) },
                { label: 'Match bans', value: String(career.matchBans) },
                { label: 'Shared-device matches', value: String(career.sharedDeviceMatches) },
                { label: 'Suspicious id', value: p.inGameUid ?? '—' },
              ].map(({ label, value }) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">{label}</span>
                  <b>{value}</b>
                </li>
              ))}
            </ul>
            {p.deviceId ? (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Device</p>
                <p className="break-all font-mono text-[10px] text-slate-500">{p.deviceId}</p>
                <AppButton
                  size="sm"
                  variant="secondary"
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  loading={watchBusy}
                  onClick={() => void watchDevice()}
                >
                  Watch this device
                </AppButton>
              </div>
            ) : (
              <p className="mt-3 text-[10.5px] text-slate-500">No device recorded.</p>
            )}
          </GlassCard>

          <GlassCard className="p-4">
            <SectionHeader
              title="Linked accounts"
              subtitle={`${detail.linkedAccounts.length} other account(s) shared this device`}
            />
            {detail.linkedAccounts.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">No shared-device accounts found.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {detail.linkedAccounts.map((account) => (
                  <li key={account.userId} className="flex items-center gap-2 text-[11px]">
                    <KeyRound className="h-3 w-3 shrink-0 text-slate-500" />
                    <button
                      type="button"
                      onClick={() => onOpenPlayer(account.userId)}
                      className="truncate font-bold hover:underline"
                    >
                      {account.inGameName || account.playerCode || account.userId.slice(0, 8)}
                    </button>
                    {account.isBanned && <StatusBadge status="REJECTED" label="Banned" />}
                    <span className="ml-auto shrink-0 text-slate-500">{account.sharedMatches} match(es)</span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>

      <ConfirmDialog
        open={banOpen}
        title={p.isBanned ? 'Unban this player?' : 'Ban this player?'}
        description={
          p.isBanned
            ? `${playerTitle(detail)} will be able to sign in and join matches again.`
            : `${playerTitle(detail)} is blocked on the next request, including any live session.`
        }
        confirmLabel={p.isBanned ? 'Unban player' : 'Ban player'}
        danger={!p.isBanned}
        busy={banning}
        onClose={() => !banning && setBanOpen(false)}
        onConfirm={() => void setBanned()}
      >
        <p className="text-[11.5px] text-slate-500">
          Bans apply to the whole account, not one match. For a single tournament, use the roster's
          match-only ban instead.
        </p>
      </ConfirmDialog>
    </div>
  );
}
