import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Wallet as WalletIcon,
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
import { FormDialog } from '../../components/common/FormDialog';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatINR, formatIST } from '../../lib/format';
import { Chip, Field, InlineError, InfoNote, TextInput } from '../matches/MatchFormBits';
import { can } from '../../lib/permissions';
import type { AdminDeposit, AdminPayment, AdminPaymentsResult, AdminWithdrawal } from '../../types';

type Tab = 'withdrawals' | 'deposits' | 'online';
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type PaymentFilter = 'ALL' | 'CAPTURED' | 'PENDING' | 'FAILED' | 'EXPIRED';

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
];

const PAYMENT_FILTERS: Array<{ id: PaymentFilter; label: string; statuses: string[] }> = [
  { id: 'ALL', label: 'All', statuses: [] },
  { id: 'CAPTURED', label: 'Captured', statuses: ['CAPTURED'] },
  { id: 'PENDING', label: 'Pending', statuses: ['CREATED', 'PENDING'] },
  { id: 'FAILED', label: 'Failed', statuses: ['FAILED'] },
  { id: 'EXPIRED', label: 'Expired', statuses: ['EXPIRED'] },
];

function playerLabel(player: { inGameName: string | null; phoneNumber: string }): string {
  return player.inGameName || player.phoneNumber;
}

export function WalletScreen() {
  const { user } = useSession();
  const toast = useToast();
  const { version } = useRealtime();

  const [tab, setTab] = useState<Tab>('withdrawals');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');

  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [payments, setPayments] = useState<AdminPaymentsResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveW, setApproveW] = useState<AdminWithdrawal | null>(null);
  const [rejectW, setRejectW] = useState<AdminWithdrawal | null>(null);
  const [approveD, setApproveD] = useState<AdminDeposit | null>(null);
  const [rejectD, setRejectD] = useState<AdminDeposit | null>(null);
  const [utr, setUtr] = useState('');
  const [reason, setReason] = useState('');

  const canManage = can(user, 'canManageWallet');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [w, d, p] = await Promise.all([
        api.wallet.withdrawals(),
        api.wallet.deposits(),
        api.wallet.payments({ limit: 40 }),
      ]);
      setWithdrawals([...w.withdrawals].reverse());
      setDeposits([...d.deposits].reverse());
      setPayments(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the wallet console');
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

  const pendingW = useMemo(() => withdrawals.filter((w) => w.status === 'PENDING'), [withdrawals]);
  const pendingD = useMemo(() => deposits.filter((d) => d.status === 'PENDING'), [deposits]);

  const shownW = useMemo(
    () => withdrawals.filter((w) => statusFilter === 'ALL' || w.status === statusFilter),
    [withdrawals, statusFilter]
  );
  const shownD = useMemo(
    () => deposits.filter((d) => statusFilter === 'ALL' || d.status === statusFilter),
    [deposits, statusFilter]
  );
  const shownP = useMemo(() => {
    const rows = payments?.payments ?? [];
    const statuses = PAYMENT_FILTERS.find((f) => f.id === paymentFilter)?.statuses ?? [];
    return statuses.length === 0 ? rows : rows.filter((p) => statuses.includes(p.status));
  }, [payments, paymentFilter]);

  const approveWithdrawal = async () => {
    if (!approveW || busyId) return;
    if (utr.trim().length < 6) {
      setActionError('UTR number must be at least 6 characters.');
      return;
    }
    setBusyId(approveW.id);
    setActionError('');
    try {
      await api.wallet.approveWithdrawal(approveW.id, utr.trim());
      toast.success(`${formatINR(Number(approveW.amount), 2)} marked paid`);
      setApproveW(null);
      setUtr('');
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not approve this withdrawal');
    } finally {
      setBusyId(null);
    }
  };

  const rejectWithdrawal = async () => {
    if (!rejectW || busyId) return;
    if (reason.trim().length < 3) {
      setActionError('Enter a rejection reason (at least 3 characters).');
      return;
    }
    setBusyId(rejectW.id);
    setActionError('');
    try {
      await api.wallet.rejectWithdrawal(rejectW.id, reason.trim());
      toast.success('Withdrawal rejected — amount returned to the player');
      setRejectW(null);
      setReason('');
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reject this withdrawal');
    } finally {
      setBusyId(null);
    }
  };

  const approveDeposit = async () => {
    if (!approveD || busyId) return;
    setBusyId(approveD.id);
    setActionError('');
    try {
      await api.wallet.approveDeposit(approveD.id);
      toast.success(`${formatINR(Number(approveD.amount), 2)} credited to the player`);
      setApproveD(null);
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not approve this deposit');
    } finally {
      setBusyId(null);
    }
  };

  const rejectDeposit = async () => {
    if (!rejectD || busyId) return;
    if (reason.trim().length < 3) {
      setActionError('Enter a rejection reason (at least 3 characters).');
      return;
    }
    setBusyId(rejectD.id);
    setActionError('');
    try {
      await api.wallet.rejectDeposit(rejectD.id, reason.trim());
      toast.success('Deposit rejected');
      setRejectD(null);
      setReason('');
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not reject this deposit');
    } finally {
      setBusyId(null);
    }
  };

  const syncPayment = async (payment: AdminPayment) => {
    if (busyId) return;
    setBusyId(payment.id);
    setActionError('');
    try {
      const result = await api.wallet.syncPayment(payment.id);
      toast.success(
        result.status === 'CAPTURED'
          ? result.alreadySettled
            ? 'Already captured — balance unchanged'
            : 'Payment captured & wallet credited'
          : 'Gateway says the payment is not captured yet'
      );
      await load(true);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not sync this payment');
    } finally {
      setBusyId(null);
    }
  };

  const closeAll = () => {
    setApproveW(null);
    setRejectW(null);
    setApproveD(null);
    setRejectD(null);
    setActionError('');
    setUtr('');
    setReason('');
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Money"
        title="Wallet"
        subtitle="Approve payouts, verify Add Cash and reconcile online payments."
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

      {/* Day summary strip */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {
            label: 'Withdrawals pending',
            value: String(pendingW.length),
            note: formatINR(pendingW.reduce((sum, w) => sum + Number(w.amount), 0), 2),
            icon: ArrowUpFromLine,
          },
          {
            label: 'Deposits pending',
            value: String(pendingD.length),
            note: formatINR(pendingD.reduce((sum, d) => sum + Number(d.amount), 0), 2),
            icon: ArrowDownToLine,
          },
          {
            label: 'Collected today',
            value: formatINR(payments?.summary.collectedTodayRupees ?? 0, 2),
            note: `${payments?.summary.capturedCount ?? 0} captured orders`,
            icon: Banknote,
          },
          {
            label: 'Online pending',
            value: String(payments?.summary.pendingCount ?? 0),
            note: payments?.summary.demoMode ? 'DEMO gateway' : 'Live gateway',
            icon: Smartphone,
          },
        ].map(({ label, value, note, icon: Icon }) => (
          <GlassCard key={label} flat className="p-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Icon className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1 text-[17px] font-black leading-none">{value}</p>
            <p className="mt-1 text-[10.5px] text-slate-500">{note}</p>
          </GlassCard>
        ))}
      </div>

      {!canManage && (
        <InlineError>Read-only: this account has no wallet permission (canManageWallet).</InlineError>
      )}
      {error && (
        <GlassCard flat className="p-4">
          <p className="text-[12.5px] font-bold text-rose-600 dark:text-rose-300">{error}</p>
          <AppButton size="sm" variant="secondary" className="mt-2" onClick={() => void load()}>
            Try again
          </AppButton>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'withdrawals' as Tab, label: 'Withdrawals', count: pendingW.length, icon: ArrowUpFromLine },
          { id: 'deposits' as Tab, label: 'Deposits', count: pendingD.length, icon: ArrowDownToLine },
          { id: 'online' as Tab, label: 'Online', count: payments?.summary.pendingCount ?? 0, icon: Smartphone },
        ].map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-black transition-colors ' +
              (tab === id
                ? 'border-[#FFD000]/60 bg-[#FFD000]/15 text-amber-600 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 dark:hover:text-white')
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] dark:bg-black/25">{count}</span>
          </button>
        ))}
      </div>

      {tab !== 'online' && (
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter.id}
              active={statusFilter === filter.id}
              onClick={() => setStatusFilter(filter.id)}
            >
              {filter.label}
            </Chip>
          ))}
        </div>
      )}

      {actionError && !approveW && !rejectW && !approveD && !rejectD && <InlineError>{actionError}</InlineError>}

      {loading ? (
        <LoadingState label="Loading the wallet console…" />
      ) : tab === 'withdrawals' ? (
        <GlassCard className="p-3 sm:p-4">
          <SectionHeader title="Withdrawal queue" subtitle="Approve with the UPI UTR, or reject to refund." />
          {shownW.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="No withdrawal requests"
              description={statusFilter === 'PENDING' ? 'The queue is clear.' : 'Nothing matches this filter.'}
            />
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/[0.06]">
              {shownW.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">{playerLabel(w.player)}</p>
                    <p className="text-[11px] text-slate-500">
                      {w.player.phoneNumber} · UPI <b className="font-mono">{w.upiId}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black">{formatINR(Number(w.amount), 2)}</p>
                    <p className="text-[10.5px] text-slate-500">{formatIST(w.createdAt)}</p>
                  </div>
                  <StatusBadge status={w.status} />
                  {w.status === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <AppButton
                        size="sm"
                        disabled={!canManage || busyId === w.id}
                        onClick={() => {
                          setApproveW(w);
                          setUtr('');
                          setActionError('');
                        }}
                      >
                        Approve
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        disabled={!canManage || busyId === w.id}
                        onClick={() => {
                          setRejectW(w);
                          setReason('');
                          setActionError('');
                        }}
                      >
                        Reject
                      </AppButton>
                    </div>
                  ) : (
                    <p className="w-full text-[10.5px] text-slate-500 sm:w-auto">
                      {w.utrNumber ? `UTR ${w.utrNumber}` : w.rejectionNote || '—'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      ) : tab === 'deposits' ? (
        <GlassCard className="p-3 sm:p-4">
          <SectionHeader title="Add Cash verification" subtitle="Check the 12-character UTR before crediting." />
          {shownD.length === 0 ? (
            <EmptyState
              icon={WalletIcon}
              title="No deposit requests"
              description={statusFilter === 'PENDING' ? 'Nothing to verify.' : 'Nothing matches this filter.'}
            />
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/[0.06]">
              {shownD.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">{playerLabel(d.player)}</p>
                    <p className="text-[11px] text-slate-500">
                      {d.player.phoneNumber} · UTR <b className="font-mono">{d.utrNumber}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black">{formatINR(Number(d.amount), 2)}</p>
                    <p className="text-[10.5px] text-slate-500">{formatIST(d.createdAt)}</p>
                  </div>
                  <StatusBadge status={d.status} />
                  {d.status === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <AppButton
                        size="sm"
                        disabled={!canManage || busyId === d.id}
                        onClick={() => {
                          setApproveD(d);
                          setActionError('');
                        }}
                      >
                        Approve
                      </AppButton>
                      <AppButton
                        size="sm"
                        variant="danger"
                        disabled={!canManage || busyId === d.id}
                        onClick={() => {
                          setRejectD(d);
                          setReason('');
                          setActionError('');
                        }}
                      >
                        Reject
                      </AppButton>
                    </div>
                  ) : (
                    <p className="w-full text-[10.5px] text-slate-500 sm:w-auto">
                      {d.rejectionNote || 'Credited'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      ) : (
        <>
          {payments?.summary.demoMode && (
            <InfoNote>
              <b>DEMO gateway</b> — online orders are mocked. Sync asks the mock provider and credits
              the wallet exactly like a real capture.
            </InfoNote>
          )}
          <div className="flex flex-wrap gap-2">
            {PAYMENT_FILTERS.map((filter) => (
              <Chip
                key={filter.id}
                active={paymentFilter === filter.id}
                onClick={() => setPaymentFilter(filter.id)}
              >
                {filter.label}
              </Chip>
            ))}
          </div>
          <GlassCard className="p-3 sm:p-4">
            <SectionHeader
              title="Online payments"
              subtitle={`${formatINR(payments?.summary.collectedTotalRupees ?? 0, 2)} collected all-time · ${
                payments?.summary.failedCount ?? 0
              } failed`}
            />
            {shownP.length === 0 ? (
              <EmptyState icon={Smartphone} title="No online orders" description="Nothing matches this filter." />
            ) : (
              <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/[0.06]">
                {shownP.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black">
                        {p.player.inGameName || p.player.phoneNumber}
                      </p>
                      <p className="truncate text-[10.5px] text-slate-500">
                        {p.provider} · {p.providerOrderId ?? p.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-black">{formatINR(p.amountRupees, 2)}</p>
                      <p className="text-[10.5px] text-slate-500">{formatIST(p.createdAt)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                    <AppButton
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      loading={busyId === p.id}
                      disabled={!canManage || busyId !== null}
                      onClick={() => void syncPayment(p)}
                    >
                      Sync
                    </AppButton>
                    {p.failureReason && (
                      <p className="w-full text-[10.5px] text-rose-600 dark:text-rose-300">{p.failureReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(payments?.pagination.totalPages ?? 1) > 1 && (
              <p className="mt-2 text-[10.5px] text-slate-500">
                Showing {payments?.payments.length ?? 0} of {payments?.pagination.total ?? 0} orders.
              </p>
            )}
          </GlassCard>
        </>
      )}

      {/* ── Approve withdrawal (UTR proof) ──────────────────────── */}
      <FormDialog
        open={Boolean(approveW)}
        title="Approve withdrawal?"
        description={
          approveW
            ? `${playerLabel(approveW.player)} — ${formatINR(Number(approveW.amount), 2)} to ${approveW.upiId}`
            : undefined
        }
        onClose={() => !busyId && closeAll()}
        busy={Boolean(approveW && busyId === approveW.id)}
        footer={
          <>
            <AppButton variant="secondary" onClick={closeAll} disabled={Boolean(busyId)}>
              Cancel
            </AppButton>
            <AppButton
              onClick={() => void approveWithdrawal()}
              loading={Boolean(approveW && busyId === approveW.id)}
            >
              Mark paid
            </AppButton>
          </>
        }
      >
        <div className="space-y-3">
          <Field
            label="UPI UTR / reference number"
            hint="Minimum 6 characters — this is the proof stored against the ledger row."
          >
            <TextInput
              value={utr}
              onChange={(event) => setUtr(event.target.value.slice(0, 64))}
              placeholder="e.g. 423891002233"
              autoFocus
            />
          </Field>
          <InfoNote>
            Approving does not move money — it records that the UPI transfer was made. Reject instead
            to return the held amount to the player's winnings.
          </InfoNote>
          {actionError && <InlineError>{actionError}</InlineError>}
        </div>
      </FormDialog>

      {/* ── Reject withdrawal ───────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(rejectW)}
        title="Reject this withdrawal?"
        description={
          rejectW
            ? `${playerLabel(rejectW.player)} — ${formatINR(Number(rejectW.amount), 2)} is returned to their winnings.`
            : undefined
        }
        confirmLabel="Reject & refund"
        danger
        busy={Boolean(rejectW && busyId === rejectW.id)}
        onClose={() => !busyId && closeAll()}
        onConfirm={() => void rejectWithdrawal()}
      >
        <Field label="Rejection reason" hint="Shown to the player (minimum 3 characters).">
          <TextInput
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 255))}
            placeholder="Wrong UPI ID"
            autoFocus
          />
        </Field>
        {actionError && <InlineError>{actionError}</InlineError>}
      </ConfirmDialog>

      {/* ── Approve deposit ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(approveD)}
        title="Credit this deposit?"
        description={
          approveD
            ? `${playerLabel(approveD.player)} — ${formatINR(Number(approveD.amount), 2)} with UTR ${approveD.utrNumber}.`
            : undefined
        }
        confirmLabel="Credit deposit"
        busy={Boolean(approveD && busyId === approveD.id)}
        onClose={() => !busyId && closeAll()}
        onConfirm={() => void approveDeposit()}
      >
        <p className="flex items-start gap-2 text-[11.5px] text-slate-500">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Confirm the UTR matches the bank statement. This credits the deposit balance and writes an
          ADD_MONEY ledger row — a double tap cannot credit twice.
        </p>
        {actionError && <InlineError>{actionError}</InlineError>}
      </ConfirmDialog>

      {/* ── Reject deposit ──────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(rejectD)}
        title="Reject this deposit?"
        description={
          rejectD
            ? `${playerLabel(rejectD.player)} — ${formatINR(Number(rejectD.amount), 2)}, UTR ${rejectD.utrNumber}.`
            : undefined
        }
        confirmLabel="Reject deposit"
        danger
        busy={Boolean(rejectD && busyId === rejectD.id)}
        onClose={() => !busyId && closeAll()}
        onConfirm={() => void rejectDeposit()}
      >
        <Field label="Rejection reason" hint="Shown to the player (minimum 3 characters).">
          <TextInput
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 255))}
            placeholder="UTR not found in bank statement"
            autoFocus
          />
        </Field>
        {actionError && <InlineError>{actionError}</InlineError>}
      </ConfirmDialog>
    </div>
  );
}
