import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Download,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
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
import { formatINR, humanize } from '../../lib/format';
import { InlineError } from '../matches/MatchFormBits';
import type { DeviceGroupDetail } from '../../types';

export function DeviceDetailPanel({
  deviceId,
  onClose,
  onChanged,
}: {
  deviceId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();

  const [detail, setDetail] = useState<DeviceGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmBan, setConfirmBan] = useState(false);
  const [busy, setBusy] = useState<'ban' | 'watch' | 'csv' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetail(await api.players.device(deviceId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this device');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const allBanned = Boolean(detail && detail.totals.accountCount > 0 && detail.totals.bannedCount === detail.totals.accountCount);

  const banAll = async () => {
    if (!detail || busy) return;
    setBusy('ban');
    setActionError('');
    try {
      const result = await api.players.banDevice(detail.deviceId, !allBanned);
      toast.success(`${result.updated} account(s) ${allBanned ? 'unbanned' : 'banned'}`);
      setConfirmBan(false);
      await load();
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change the ban state');
    } finally {
      setBusy(null);
    }
  };

  const watch = async () => {
    if (!detail || busy) return;
    setBusy('watch');
    setActionError('');
    try {
      await api.players.watch(detail.deviceId, 'Flagged from device groups');
      toast.success('Device added to the watchlist');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not watch this device');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    if (!detail || busy) return;
    setBusy('csv');
    try {
      await api.players.deviceCsv(detail.deviceId);
      toast.success('Device CSV downloaded');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download the CSV');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-950 dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All devices
      </button>

      <SectionHeader
        eyebrow="Device group"
        title={deviceId.length > 22 ? `${deviceId.slice(0, 22)}…` : deviceId}
        subtitle={
          detail
            ? `${detail.totals.accountCount} account(s) · ${detail.totals.collidedMatchCount} shared match(es) · ${formatINR(
                detail.totals.netOut,
                2
              )} net out`
            : 'Loading…'
        }
        action={
          <>
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
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              loading={busy === 'watch'}
              disabled={!detail}
              onClick={() => void watch()}
            >
              Watch
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              loading={busy === 'csv'}
              disabled={!detail}
              onClick={() => void exportCsv()}
            >
              CSV
            </AppButton>
            <AppButton
              size="sm"
              variant={allBanned ? 'primary' : 'danger'}
              icon={<Ban className="h-3.5 w-3.5" />}
              disabled={!detail}
              onClick={() => setConfirmBan(true)}
            >
              {allBanned ? 'Unban all' : 'Ban all'}
            </AppButton>
          </>
        }
      />

      {error && <InlineError>{error}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      {loading || !detail ? (
        <GlassCard className="p-4">
          <LoadingState label="Loading device group…" />
        </GlassCard>
      ) : detail.accounts.length === 0 ? (
        <GlassCard className="p-4">
          <EmptyState icon={Smartphone} title="No accounts on this device" />
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { label: 'Accounts', value: String(detail.totals.accountCount) },
              { label: 'Banned', value: String(detail.totals.bannedCount) },
              { label: 'Shared matches', value: String(detail.totals.collidedMatchCount) },
              { label: 'Winnings', value: formatINR(detail.totals.totalWinnings, 2) },
            ].map(({ label, value }) => (
              <GlassCard key={label} flat className="p-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</p>
                <p className="mt-1 text-[15px] font-black leading-none">{value}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-3 sm:p-4">
            <SectionHeader title="Accounts on this device" subtitle="Balances come from the ledger." />
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    <th className="pb-2">Player</th>
                    <th className="pb-2">Phone</th>
                    <th className="pb-2 text-right">Matches</th>
                    <th className="pb-2 text-right">Shared</th>
                    <th className="pb-2 text-right">Winnings</th>
                    <th className="pb-2 text-right">Net out</th>
                    <th className="pb-2">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                  {detail.accounts.map((account) => (
                    <tr key={account.userId}>
                      <td className="py-2 text-[11.5px] font-bold">
                        {account.inGameName || account.playerCode || account.userId.slice(0, 8)}
                        <span className="block text-[9.5px] font-normal text-slate-500">
                          {account.name ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 text-[10.5px] text-slate-500">{account.phoneNumber}</td>
                      <td className="py-2 text-right text-[11px]">{account.matchesJoined}</td>
                      <td className="py-2 text-right text-[11px]">{account.collidedMatches}</td>
                      <td className="py-2 text-right text-[11px]">{formatINR(account.totalWinnings, 2)}</td>
                      <td className="py-2 text-right text-[11px]">{formatINR(account.netOut, 2)}</td>
                      <td className="py-2">
                        <StatusBadge status={account.isBanned ? 'REJECTED' : 'APPROVED'} label={account.isBanned ? 'Banned' : 'Active'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="p-3 sm:p-4">
            <SectionHeader
              title="Shared matches"
              subtitle="Where two or more accounts on this device played together."
            />
            {detail.sharedMatches.length === 0 ? (
              <EmptyState icon={Users} title="No shared matches" description="Accounts exist, but never played together." />
            ) : (
              <ul className="mt-2 divide-y divide-slate-200 dark:divide-white/[0.06]">
                {detail.sharedMatches.map((match) => (
                  <li key={match.tournamentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <p className="text-[12px] font-black">
                      #{match.matchNumber ?? '—'} {humanize(match.mapType)} • {humanize(match.matchType)}
                    </p>
                    <StatusBadge status={match.status} />
                    <p className="text-[10.5px] text-slate-500">{match.accountCodes.join(', ')}</p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </>
      )}

      <ConfirmDialog
        open={confirmBan}
        title={allBanned ? 'Unban every account on this device?' : 'Ban every account on this device?'}
        description={
          allBanned
            ? 'All accounts will be able to sign in and join matches again.'
            : 'Every account sharing this device is blocked on its next request — including live sessions.'
        }
        confirmLabel={allBanned ? 'Unban all' : 'Ban all'}
        danger={!allBanned}
        busy={busy === 'ban'}
        onClose={() => !busy && setConfirmBan(false)}
        onConfirm={() => void banAll()}
      >
        <p className="text-[11.5px] text-slate-500">
          Use this for device farms where multiple accounts are farming prizes. Single-account bans
          live on the player profile.
        </p>
      </ConfirmDialog>
    </div>
  );
}
