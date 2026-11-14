import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  UserPlus,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { FormDialog } from '../../components/common/FormDialog';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatIST, humanize } from '../../lib/format';
import { Field, InlineError, InfoNote, TextInput, Toggle } from '../matches/MatchFormBits';
import { PERMISSION_LABELS } from '../../lib/permissions';
import type { AdminAccessKey, IssuedAccessKey, PermissionKey } from '../../types';

const PERMISSION_KEYS: PermissionKey[] = [
  'canCreateMatch',
  'canUpdateRoomId',
  'canDistributePrize',
  'canManageWallet',
];

type Busy = { id: string; action: 'revoke' | 'regenerate' } | null;

function whatsappKeyUrl(name: string, email: string, key: string): string {
  const text = `Spartan Arena admin access for ${name}\nEmail: ${email}\nPermission key: ${key}\nOpen: ${window.location.origin}/login`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function StaffScreen() {
  const toast = useToast();

  const [keys, setKeys] = useState<AdminAccessKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  // Issue dialog
  const [issueOpen, setIssueOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>({
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: false,
    canManageWallet: false,
  });
  const [issuing, setIssuing] = useState(false);

  // One-time reveal
  const [issued, setIssued] = useState<IssuedAccessKey | null>(null);
  const [issuedFor, setIssuedFor] = useState<{ name: string; email: string } | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<AdminAccessKey | null>(null);
  const [regenTarget, setRegenTarget] = useState<AdminAccessKey | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await api.accessKeys.list();
      setKeys(result.keys);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load staff access keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(() => keys.filter((k) => k.status === 'ACTIVE' && !k.isBanned), [keys]);

  const openIssue = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPerms({
      canCreateMatch: true,
      canUpdateRoomId: true,
      canDistributePrize: false,
      canManageWallet: false,
    });
    setActionError('');
    setIssueOpen(true);
  };

  const submitIssue = async () => {
    if (issuing) return;
    if (name.trim().length < 2) return setActionError('Staff name must be at least 2 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setActionError('Enter a valid email address.');
    if (!/^\+?\d{10,15}$/.test(phone.trim())) return setActionError('Enter a valid phone number (10–15 digits).');

    setIssuing(true);
    setActionError('');
    try {
      const result = await api.accessKeys.issue({
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phone.trim(),
        permissions: perms,
      });
      setIssueOpen(false);
      setIssued(result);
      setIssuedFor({ name: name.trim(), email: email.trim() });
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not generate the access key');
    } finally {
      setIssuing(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget || busy) return;
    setBusy({ id: revokeTarget.id, action: 'revoke' });
    setActionError('');
    try {
      await api.accessKeys.revoke(revokeTarget.id);
      toast.success('Key revoked — that staff session is dead on the next request');
      setRevokeTarget(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not revoke the key');
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    if (!regenTarget || busy) return;
    setBusy({ id: regenTarget.id, action: 'regenerate' });
    setActionError('');
    try {
      const result = await api.accessKeys.regenerate(regenTarget.id);
      setRegenTarget(null);
      setIssued(result);
      setIssuedFor({
        name: regenTarget.name ?? 'Staff',
        email: regenTarget.email ?? '',
      });
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not regenerate the key');
    } finally {
      setBusy(null);
    }
  };

  const copyKey = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.accessKey);
      toast.success('Key copied');
    } catch {
      toast.error('Could not copy — select the key text manually');
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Owner controls"
        title="Staff & Access"
        subtitle="Sub-admins log in with the owner email + their one-time permission key + an OTP."
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
            <AppButton size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={openIssue}>
              Generate access
            </AppButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Active keys', value: String(active.length), icon: ShieldCheck },
          { label: 'Total issued', value: String(keys.length), icon: KeyRound },
          {
            label: 'Revoked / expired',
            value: String(keys.filter((k) => k.status !== 'ACTIVE').length),
            icon: ShieldOff,
          },
        ].map(({ label, value, icon: Icon }) => (
          <GlassCard key={label} flat className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1 text-[17px] font-black leading-none">{value}</p>
          </GlassCard>
        ))}
      </div>

      {error && <InlineError>{error}</InlineError>}
      {actionError && !issueOpen && !issued && <InlineError>{actionError}</InlineError>}

      {loading ? (
        <LoadingState label="Loading staff access…" />
      ) : keys.length === 0 ? (
        <GlassCard className="p-4">
          <EmptyState
            icon={KeyRound}
            title="No staff keys yet"
            description="Generate a key, share it once over WhatsApp, and the sub-admin can log in immediately."
            action={
              <AppButton size="sm" icon={<Plus className="h-4 w-4" />} onClick={openIssue}>
                Generate access
              </AppButton>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => {
            const rowBusy = busy?.id === key.id;
            return (
              <GlassCard key={key.id} className="p-3 sm:p-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-black">{key.name ?? 'Unnamed staff'}</p>
                      <StatusBadge status={key.role === 'ADMIN' ? 'APPROVED' : key.status} label={key.role === 'ADMIN' ? 'OWNER' : humanize(key.status)} />
                      {key.isBanned && <StatusBadge status="REJECTED" label="Banned" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {key.email ?? '—'} · {key.phoneNumber ?? '—'} · key{' '}
                      <b className="font-mono">{key.keyHint}</b>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {PERMISSION_KEYS.filter((p) => key.permissions[p]).map((p) => (
                        <span
                          key={p}
                          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                        >
                          {PERMISSION_LABELS[p].label}
                        </span>
                      ))}
                      {PERMISSION_KEYS.every((p) => !key.permissions[p]) && (
                        <span className="text-[10px] text-slate-500">No permissions</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[10.5px] text-slate-500">
                    <p>Created {formatIST(key.createdAt)}</p>
                    <p>Last login {key.lastUsedAt ? formatIST(key.lastUsedAt) : 'never'}</p>
                    {key.expiresAt && <p>Expires {formatIST(key.expiresAt)}</p>}
                  </div>

                  {key.status === 'ACTIVE' && (
                    <div className="flex items-center gap-1.5">
                      <AppButton
                        size="sm"
                        variant="secondary"
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                        loading={rowBusy && busy?.action === 'regenerate'}
                        disabled={Boolean(busy)}
                        onClick={() => {
                          setActionError('');
                          setRegenTarget(key);
                        }}
                      >
                        New key
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        icon={<ShieldOff className="h-3.5 w-3.5" />}
                        loading={rowBusy && busy?.action === 'revoke'}
                        disabled={Boolean(busy)}
                        onClick={() => {
                          setActionError('');
                          setRevokeTarget(key);
                        }}
                      >
                        Revoke
                      </AppButton>
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ── Generate access ─────────────────────────────────────── */}
      <FormDialog
        open={issueOpen}
        title="Generate staff access"
        description="The key is shown only once. Share it yourself — the staff member signs in with the owner email + this key + an OTP."
        onClose={() => !issuing && setIssueOpen(false)}
        busy={issuing}
        footer={
          <>
            <AppButton variant="secondary" onClick={() => setIssueOpen(false)} disabled={issuing}>
              Cancel
            </AppButton>
            <AppButton onClick={() => void submitIssue()} loading={issuing}>
              Generate key
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Staff name">
            <TextInput value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Ravi Kumar" autoFocus />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" hint="OTP goes to the owner mailbox, not this one.">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.slice(0, 120))}
                placeholder="staff@example.com"
              />
            </Field>
            <Field label="Phone number">
              <TextInput
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                placeholder="9876543210"
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
              Permissions
            </p>
            <div className="space-y-1.5">
              {PERMISSION_KEYS.map((p) => (
                <Toggle
                  key={p}
                  checked={perms[p]}
                  onChange={(value) => setPerms((current) => ({ ...current, [p]: value }))}
                  label={PERMISSION_LABELS[p].label}
                  hint={PERMISSION_LABELS[p].hint}
                />
              ))}
            </div>
          </div>

          <InfoNote>
            Turning a permission off takes effect on the staff member's next request — no re-login
            needed. Revoking the key kills the session instantly.
          </InfoNote>
          {actionError && <InlineError>{actionError}</InlineError>}
        </div>
      </FormDialog>

      {/* ── One-time key reveal ─────────────────────────────────── */}
      <FormDialog
        open={Boolean(issued)}
        title="Copy this key now"
        description={
          issuedFor
            ? `${issuedFor.name} — the key is never shown again. Send it over WhatsApp or copy it.`
            : undefined
        }
        onClose={() => setIssued(null)}
        footer={
          <AppButton icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setIssued(null)}>
            I have saved this key
          </AppButton>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-[#FFD000]/50 bg-[#FFD000]/10 p-3">
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Permission key
            </p>
            <p className="mt-1 break-all font-mono text-[15px] font-black tracking-wider">
              {issued?.accessKey}
            </p>
            {issued?.expiresAt && (
              <p className="mt-1 text-[10.5px] text-slate-500">Expires {formatIST(issued.expiresAt)}</p>
            )}
          </div>
          <InfoNote>
            Staff login: choose <b>Staff</b> on the login screen → owner email → this key → the OTP
            that arrives in the owner mailbox.
          </InfoNote>
          <div className="flex flex-wrap gap-2">
            <AppButton size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void copyKey()}>
              Copy key
            </AppButton>
            {issued && issuedFor && (
              <a
                href={whatsappKeyUrl(issuedFor.name, issuedFor.email, issued.accessKey)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.03]"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </FormDialog>

      {/* ── Revoke / regenerate confirms ────────────────────────── */}
      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke this key?"
        description={
          revokeTarget
            ? `${revokeTarget.name ?? revokeTarget.email ?? 'This staff member'} is signed out immediately and cannot log in again with the old key.`
            : undefined
        }
        confirmLabel="Revoke key"
        danger
        busy={Boolean(busy && revokeTarget && busy.id === revokeTarget.id)}
        onClose={() => !busy && setRevokeTarget(null)}
        onConfirm={() => void revoke()}
      >
        {actionError && <InlineError>{actionError}</InlineError>}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(regenTarget)}
        title="Generate a new key?"
        description={
          regenTarget
            ? `The old key for ${regenTarget.name ?? regenTarget.email ?? 'this staff member'} stops working. You will see the new key once.`
            : undefined
        }
        confirmLabel="Generate new key"
        busy={Boolean(busy && regenTarget && busy.id === regenTarget.id)}
        onClose={() => !busy && setRegenTarget(null)}
        onConfirm={() => void regenerate()}
      >
        {actionError && <InlineError>{actionError}</InlineError>}
      </ConfirmDialog>
    </div>
  );
}
