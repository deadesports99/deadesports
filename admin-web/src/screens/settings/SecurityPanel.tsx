import { useCallback, useEffect, useState } from 'react';
import { Laptop, LogOut, MonitorSmartphone, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { StatusBadge } from '../../components/common/StatusBadge';
import { InlineError, InfoNote } from '../matches/MatchFormBits';
import { cx } from '../../lib/format';
import type { AdminAuditRow, AdminSessionInfo } from '../../types';

/**
 * Security console (owner settings).
 *
 * Two questions the product could not answer before:
 *   • "Where am I still signed in?" → live device list with per-device revoke
 *   • "Who did what?"              → readable admin activity trail
 *
 * Revoking a device is instant: the session row is deleted server-side, so a
 * copied cookie dies on its very next request.
 */

/** `Mozilla/5.0 (Windows NT 10.0…) Chrome/120…` → `Chrome · Windows`. */
function describeAgent(userAgent: string | null): { label: string; mobile: boolean } {
  const ua = userAgent ?? '';
  if (!ua) return { label: 'Unknown device', mobile: false };

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';

  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';

  return { label: `${browser} · ${os}`, mobile: /Android|iPhone|iPad/.test(ua) };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const ACTION_LABELS: Record<string, string> = {
  ADMIN_LOGIN: 'Signed in',
  ADMIN_LOGOUT: 'Signed out',
  ADMIN_OTP_REQUESTED: 'Sign-in code sent',
  ADMIN_STEP_UP_REQUESTED: 'Confirmation code sent',
  ADMIN_STEP_UP_VERIFIED: 'Confirmed with code',
  STAFF_ACCESS_ISSUED: 'Staff key issued',
  STAFF_ACCESS_REVOKED: 'Staff key revoked',
  STAFF_ACCESS_REGENERATED: 'Staff key rotated',
};

export function SecurityPanel() {
  const toast = useToast();
  const { signOut } = useSession();

  const [sessions, setSessions] = useState<AdminSessionInfo[]>([]);
  const [activity, setActivity] = useState<AdminAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [sessionResult, auditResult] = await Promise.allSettled([
        api.security.sessions(),
        api.security.audit(15),
      ]);

      if (sessionResult.status === 'fulfilled') {
        setSessions(sessionResult.value.sessions);
      } else {
        throw sessionResult.reason;
      }

      // A staff account cannot read the audit trail — that must not break the page.
      if (auditResult.status === 'fulfilled') setActivity(auditResult.value.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (session: AdminSessionInfo) => {
    setBusyId(session.id);
    try {
      await api.security.revokeSession(session.id);
      toast.success('That device was signed out');
      await load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign that device out');
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setBusyId('others');
    try {
      const result = await api.security.revokeOtherSessions();
      toast.success(result.revoked > 0 ? `${result.revoked} device(s) signed out` : 'No other devices');
      setConfirmOthers(false);
      await load(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign the other devices out');
    } finally {
      setBusyId(null);
    }
  };

  const revokeAll = async () => {
    setBusyId('all');
    try {
      const result = await api.security.revokeAllSessions();
      setConfirmAll(false);
      toast.success(`Signed out on ${result.revoked} device(s)`);
      // Everything — including this browser — is dead now.
      await signOut();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign out everywhere');
      setBusyId(null);
    }
  };

  const active = sessions.filter((session) => session.active);
  const others = active.filter((session) => !session.current);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <GlassCard className="p-4">
        <SectionHeader
          title="Active devices"
          subtitle="Every browser signed in to this account. Sign one out and its cookie stops working immediately."
          action={
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
              disabled={loading}
              onClick={() => void load()}
            >
              Refresh
            </AppButton>
          }
        />

        {error && (
          <div className="mt-3">
            <InlineError>{error}</InlineError>
          </div>
        )}

        {active.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={MonitorSmartphone}
              title="No sessions"
              description="Sign in again to see this device listed here."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200/70 dark:divide-white/5">
            {active.map((session) => {
              const agent = describeAgent(session.userAgent);
              const Icon = agent.mobile ? Smartphone : Laptop;
              return (
                <li key={session.id} className="flex items-start gap-3 py-2.5">
                  <div
                    className={cx(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      session.current
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : 'bg-slate-500/10 text-slate-500 dark:text-slate-300'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {agent.label}
                      </span>
                      {session.current && <StatusBadge status="ACTIVE" label="This device" />}
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                      {session.ip ?? 'IP unknown'} · seen {timeAgo(session.lastSeenAt)}
                    </p>
                  </div>

                  {!session.current && (
                    <AppButton
                      variant="ghost"
                      size="sm"
                      icon={<LogOut className="h-3.5 w-3.5" />}
                      loading={busyId === session.id}
                      disabled={Boolean(busyId)}
                      onClick={() => void revoke(session)}
                    >
                      Sign out
                    </AppButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            icon={<LogOut className="h-3.5 w-3.5" />}
            disabled={Boolean(busyId) || others.length === 0}
            loading={busyId === 'others'}
            onClick={() => setConfirmOthers(true)}
          >
            Sign out other devices
          </AppButton>
          <AppButton
            variant="danger"
            size="sm"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            disabled={Boolean(busyId)}
            onClick={() => setConfirmAll(true)}
          >
            Sign out everywhere
          </AppButton>
        </div>

        <div className="mt-3">
          <InfoNote>
            Cookie stolen? <b>Sign out everywhere</b> kills every session and every copied token
            instantly — no need to restart the server.
          </InfoNote>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <SectionHeader
          title="Recent admin activity"
          subtitle="Logins, confirmations, staff keys and money actions written by the server."
        />

        {activity.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={ShieldCheck}
              title="Nothing recorded yet"
              description="Logins and money actions show up here as they happen."
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {activity.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                    {ACTION_LABELS[row.action] ?? row.action}
                  </p>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                    {row.actorName ?? row.actorRole ?? 'system'}
                    {row.ip ? ` · ${row.ip}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                  {timeAgo(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <ConfirmDialog
        open={confirmOthers}
        title="Sign out other devices?"
        description="Every other browser loses access immediately. This device stays signed in."
        confirmLabel="Sign them out"
        busy={busyId === 'others'}
        onConfirm={() => void revokeOthers()}
        onClose={() => setConfirmOthers(false)}
      />

      <ConfirmDialog
        open={confirmAll}
        title="Sign out everywhere?"
        description="Every session, including this browser, is killed instantly. You will need a new sign-in code. Use this if you think your session was stolen."
        confirmLabel="Sign out everywhere"
        danger
        busy={busyId === 'all'}
        onConfirm={() => void revokeAll()}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  );
}
