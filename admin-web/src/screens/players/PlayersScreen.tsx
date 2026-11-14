import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Trash2,
  UserSearch,
  Users,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { formatINR, formatIST } from '../../lib/format';
import { Chip, InlineError } from '../matches/MatchFormBits';
import { PlayerDetailPanel } from './PlayerDetailPanel';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import type { AdminPlayerRow, DeviceGroup, SuspiciousPlayer, WatchlistSummary } from '../../types';

type View = 'search' | 'suspicious' | 'devices' | 'watchlist';

const SCORE_THRESHOLDS = [30, 50, 70];

const VIEW_PATHS: Record<View, string> = {
  search: '/players',
  suspicious: '/players/suspicious',
  devices: '/players/devices',
  watchlist: '/players/watchlist',
};

function viewFromPath(pathname: string): View {
  if (pathname.startsWith('/players/suspicious')) return 'suspicious';
  if (pathname.startsWith('/players/devices')) return 'devices';
  if (pathname.startsWith('/players/watchlist')) return 'watchlist';
  return 'search';
}

export function PlayersScreen() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routePlayerId } = useParams();

  const [view, setView] = useState<View>(() => viewFromPath(location.pathname));
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(routePlayerId ?? null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<AdminPlayerRow[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);

  const [suspicious, setSuspicious] = useState<SuspiciousPlayer[]>([]);
  const [threshold, setThreshold] = useState(30);

  const [devices, setDevices] = useState<DeviceGroup[]>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);

  const [watchlist, setWatchlist] = useState<WatchlistSummary | null>(null);
  const [busyDevice, setBusyDevice] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const loadPlayers = useCallback(async (term: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.players.list(term, 50);
      setPlayers(result.players);
      setPlayerTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load players');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSuspicious = useCallback(async (minScore: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.players.suspicious(minScore);
      setSuspicious(result.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load suspicious players');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.players.devices();
      setDevices(result.groups);
      setDeviceTotal(result.totalDevices);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load device groups');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWatchlist(await api.players.watchlist());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the watchlist');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search is debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    if (view !== 'search' || selectedPlayer) return undefined;
    const timer = setTimeout(() => void loadPlayers(search), 350);
    return () => clearTimeout(timer);
  }, [view, search, selectedPlayer, loadPlayers]);

  useEffect(() => {
    if (view === 'suspicious' && !selectedPlayer) void loadSuspicious(threshold);
    if (view === 'devices') void loadDevices();
    if (view === 'watchlist') void loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, threshold]);

  // Deep links (/players/watchlist, /players/devices/…) set the tab on mount
  // and whenever the sidebar navigates between the player sections.
  useEffect(() => {
    setView(viewFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    if (routePlayerId) {
      setSelectedPlayer(routePlayerId);
      setSelectedDevice(null);
    }
  }, [routePlayerId]);

  const refresh = () => {
    if (view === 'search') void loadPlayers(search);
    if (view === 'suspicious') void loadSuspicious(threshold);
    if (view === 'devices') void loadDevices();
    if (view === 'watchlist') void loadWatchlist();
  };

  const openPlayer = (playerId: string) => {
    window.scrollTo({ top: 0 });
    setSelectedPlayer(playerId);
    setSelectedDevice(null);
    navigate(`/players/${playerId}`);
  };

  const closePlayer = () => {
    setSelectedPlayer(null);
    navigate('/players');
  };

  const switchView = (next: View) => {
    setView(next);
    setSelectedPlayer(null);
    setSelectedDevice(null);
    setActionError('');
    navigate(VIEW_PATHS[next]);
  };

  const ack = async (deviceId: string) => {
    if (busyDevice) return;
    setBusyDevice(deviceId);
    setActionError('');
    try {
      await api.players.ackAlerts(deviceId);
      toast.success('Alerts acknowledged');
      await loadWatchlist();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not acknowledge the alerts');
    } finally {
      setBusyDevice(null);
    }
  };

  const unwatch = async (deviceId: string) => {
    if (busyDevice) return;
    setBusyDevice(deviceId);
    setActionError('');
    try {
      await api.players.unwatch(deviceId);
      toast.success('Device removed from the watchlist');
      await loadWatchlist();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not stop watching this device');
    } finally {
      setBusyDevice(null);
    }
  };

  const suspiciousCount = useMemo(
    () => suspicious.filter((row) => row.score >= threshold).length,
    [suspicious, threshold]
  );

  if (selectedPlayer) {
    return (
      <PlayerDetailPanel
        playerId={selectedPlayer}
        onClose={closePlayer}
        onChanged={refresh}
        onOpenPlayer={openPlayer}
        onOpenMatch={(matchId) => navigate(`/matches/${matchId}`)}
      />
    );
  }

  if (selectedDevice) {
    return (
      <DeviceDetailPanel
        deviceId={selectedDevice}
        onClose={() => {
          setSelectedDevice(null);
          void loadDevices();
        }}
        onChanged={() => void loadDevices()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Owner controls"
        title="Players & anti-cheat"
        subtitle="Search any account, audit its money, ban it, and catch device farms."
        action={
          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            disabled={loading}
            onClick={refresh}
          >
            Refresh
          </AppButton>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'search' as View, label: 'Players', icon: UserSearch },
          { id: 'suspicious' as View, label: 'Suspicious', icon: ShieldAlert },
          { id: 'devices' as View, label: 'Device groups', icon: Smartphone },
          {
            id: 'watchlist' as View,
            label: `Watchlist${watchlist?.totalAlerts ? ` (${watchlist.totalAlerts})` : ''}`,
            icon: Eye,
          },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchView(id)}
            className={
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-black transition-colors ' +
              (view === id
                ? 'border-[#FFD000]/60 bg-[#FFD000]/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 dark:hover:text-white')
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {error && <InlineError>{error}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      {/* ── Players search ──────────────────────────────────────── */}
      {view === 'search' && (
        <>
          <GlassCard flat className="p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Player code, phone, name, IGN or FF UID…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-[12px] font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#FFD000]/70 dark:border-white/10 dark:bg-[#060B14] dark:text-white dark:placeholder:text-slate-600"
              />
            </div>
            <p className="mt-1.5 text-[10.5px] text-slate-500">
              {playerTotal} player(s) in this tenant · showing the newest {players.length}
            </p>
          </GlassCard>

          {loading ? (
            <LoadingState label="Searching players…" />
          ) : players.length === 0 ? (
            <GlassCard className="p-4">
              <EmptyState
                icon={Users}
                title="No players found"
                description={search ? 'Try a different player code, phone or IGN.' : 'No players in this tenant yet.'}
              />
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => openPlayer(player.id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#FFD000]/60 dark:border-white/[0.08] dark:bg-[#0C121E]/85 dark:hover:border-[#FFD000]/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">
                      {player.inGameName || player.name || player.phoneNumber}
                      {player.playerCode && (
                        <span className="ml-2 rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-500 dark:border-white/10">
                          {player.playerCode}
                        </span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-slate-500">
                      {player.phoneNumber} · UID {player.inGameUid ?? '—'} · joined {formatIST(player.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11.5px] font-black">
                      {formatINR(Number(player.winningBalance), 2)}
                      <span className="ml-1 text-[9px] font-bold text-slate-500">winnings</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatINR(Number(player.depositBalance), 2)} deposit · {player.matchesJoined} matches
                    </p>
                  </div>
                  <StatusBadge status={player.isBanned ? 'REJECTED' : 'APPROVED'} label={player.isBanned ? 'Banned' : 'Active'} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Suspicious ──────────────────────────────────────────── */}
      {view === 'suspicious' && (
        <>
          <GlassCard flat className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Min score
            </span>
            {SCORE_THRESHOLDS.map((score) => (
              <Chip key={score} active={threshold === score} onClick={() => setThreshold(score)}>
                {score}+
              </Chip>
            ))}
            <span className="ml-auto text-[10.5px] text-slate-500">
              {suspiciousCount} account(s) at or above {threshold}
            </span>
          </GlassCard>

          {loading ? (
            <LoadingState label="Scoring accounts…" />
          ) : suspicious.length === 0 ? (
            <GlassCard className="p-4">
              <EmptyState
                icon={CheckCircle2}
                title="Nothing looks suspicious"
                description="No account crossed this score with the current signals."
              />
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {suspicious.map((row) => (
                <GlassCard key={row.userId} className="p-3">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black">
                        {row.inGameName || row.name || row.phoneNumber}
                        {row.playerCode && (
                          <span className="ml-2 rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-slate-500 dark:border-white/10">
                            {row.playerCode}
                          </span>
                        )}
                        {row.isBanned && <span className="ml-2"><StatusBadge status="REJECTED" label="Banned" /></span>}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {row.phoneNumber} · {row.stats.matchesJoined} matches · {row.stats.completedMatches} completed ·{' '}
                        {row.stats.accountsOnDevice} account(s) on device · net out{' '}
                        {formatINR(row.stats.netOut, 2)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {row.signals.map((signal) => (
                          <span
                            key={signal.code}
                            title={signal.detail}
                            className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                          >
                            {signal.label} +{signal.weight}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[20px] font-black leading-none text-rose-600 dark:text-rose-300">
                        {row.score}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">risk score</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        avg {row.stats.avgKills} · recent {row.stats.recentAvgKills} · win {row.stats.winRatePct}%
                      </p>
                    </div>
                    <AppButton size="sm" variant="secondary" onClick={() => openPlayer(row.userId)}>
                      Open
                    </AppButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Device groups ───────────────────────────────────────── */}
      {view === 'devices' && (
        <>
          <InformationStrip>
            {deviceTotal} device(s) seen · {devices.length} with 2+ accounts, ranked by shared matches
            then money out.
          </InformationStrip>
          {loading ? (
            <LoadingState label="Finding device groups…" />
          ) : devices.length === 0 ? (
            <GlassCard className="p-4">
              <EmptyState
                icon={Smartphone}
                title="No shared devices"
                description="Every account has its own device — nothing to investigate."
              />
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {devices.map((group) => (
                <GlassCard key={group.deviceId} className="p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11.5px] font-black">
                        {group.deviceId.length > 28 ? `${group.deviceId.slice(0, 28)}…` : group.deviceId}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {group.accountCount} accounts · {group.collidedMatchCount} shared matches ·{' '}
                        {group.bannedCount} banned · net out {formatINR(group.netOut, 2)}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {group.accounts
                          .map((account) => account.inGameName || account.playerCode || account.userId.slice(0, 6))
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-black">{formatINR(group.totalWinnings, 2)}</p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">winnings</p>
                    </div>
                    <div className="flex gap-1.5">
                      <AppButton
                        size="sm"
                        variant="secondary"
                        icon={<Eye className="h-3.5 w-3.5" />}
                        onClick={() => void (async () => {
                          if (busyDevice) return;
                          setBusyDevice(group.deviceId);
                          setActionError('');
                          try {
                            await api.players.watch(group.deviceId, 'Flagged from device groups');
                            toast.success('Device added to the watchlist');
                          } catch (err) {
                            setActionError(err instanceof ApiError ? err.message : 'Could not watch this device');
                          } finally {
                            setBusyDevice(null);
                          }
                        })()}
                      >
                        Watch
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="secondary"
                        icon={<AlertTriangle className="h-3.5 w-3.5" />}
                        onClick={() => {
                          window.scrollTo({ top: 0 });
                          setSelectedDevice(group.deviceId);
                        }}
                      >
                        Investigate
                      </AppButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Watchlist ───────────────────────────────────────────── */}
      {view === 'watchlist' && (
        <>
          <InformationStrip>
            {watchlist?.totalWatched ?? 0} watched device(s) · {watchlist?.totalAlerts ?? 0} pending
            alert(s). New accounts that join while a device is watched raise an alert here.
          </InformationStrip>
          {loading ? (
            <LoadingState label="Loading the watchlist…" />
          ) : !watchlist || watchlist.devices.length === 0 ? (
            <GlassCard className="p-4">
              <EmptyState
                icon={EyeOff}
                title="Watchlist is empty"
                description="Open a device group and press Watch to monitor new accounts on it."
              />
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {watchlist.devices.map((device) => (
                <GlassCard key={device.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11.5px] font-black">
                        {device.deviceId.length > 28 ? `${device.deviceId.slice(0, 28)}…` : device.deviceId}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {device.accountCount} accounts · {device.newAccountCount} new ·{' '}
                        {device.collidedMatchCount} shared matches · {device.bannedCount} banned
                        {device.note ? ` · ${device.note}` : ''}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Watching since {formatIST(device.createdAt)}
                        {device.lastSeenAt ? ` · last signal ${formatIST(device.lastSeenAt)}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={
                          'text-[18px] font-black leading-none ' +
                          (device.alertCount > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-slate-400')
                        }
                      >
                        {device.alertCount}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">alerts</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <AppButton
                        size="sm"
                        variant="secondary"
                        disabled={device.alertCount === 0 || busyDevice === device.deviceId}
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        onClick={() => void ack(device.deviceId)}
                      >
                        Ack
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="secondary"
                        icon={<AlertTriangle className="h-3.5 w-3.5" />}
                        onClick={() => {
                          window.scrollTo({ top: 0 });
                          setSelectedDevice(device.deviceId);
                        }}
                      >
                        Open
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        loading={busyDevice === device.deviceId}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => void unwatch(device.deviceId)}
                      >
                        Unwatch
                      </AppButton>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InformationStrip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-[11px] text-cyan-800 dark:border-cyan-400/25 dark:bg-cyan-400/[0.06] dark:text-cyan-200">
      {children}
    </p>
  );
}
