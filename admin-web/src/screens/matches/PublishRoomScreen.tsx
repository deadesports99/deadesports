import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { CopyField } from '../../components/common/CopyField';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { formatCountdown, formatIST, humanize } from '../../lib/format';
import { roomShareText, whatsappShareUrl } from '../../lib/matchUi';
import { useRealtime } from '../../context/RealtimeContext';
import { Field, InlineError, InfoNote, TextInput } from './MatchFormBits';
import type { AdminTournament } from '../../types';

/**
 * Publish Room — the ONE place the custom room lives (canUpdateRoomId).
 *
 * Backend rule: publishing IS the reveal. There is no clock — credentials reach
 * joined players the moment this screen saves them, and editing an already
 * published room updates the players silently.
 */
export function PublishRoomScreen() {
  const toast = useToast();
  const { version } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();

  const [matches, setMatches] = useState<AdminTournament[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('match'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [seatedWarning, setSeatedWarning] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const selected = useMemo(
    () => matches.find((match) => match.id === selectedId) ?? null,
    [matches, selectedId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await api.matches.listAll({ publishable: true });
      setMatches(
        [...items].sort((a, b) => new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime())
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load publishable matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime (slot bookings, status flips) keeps the picker honest.
  useEffect(() => {
    if (version > 0) void load();
  }, [version, load]);

  // Prefill the form when the selected match changes.
  useEffect(() => {
    if (!selected) {
      setRoomId('');
      setRoomPassword('');
      return;
    }
    setRoomId(selected.room?.roomId ?? '');
    setRoomPassword(selected.room?.roomPassword ?? '');
    setFormError('');
    setSeatedWarning(null);
  }, [selected]);

  const selectMatch = (id: string) => {
    setSelectedId(id);
    setSearchParams({ match: id }, { replace: true });
  };

  const save = async () => {
    if (!selected || busy) return;
    setFormError('');
    setSeatedWarning(null);

    if (!roomId.trim() || !roomPassword.trim()) {
      setFormError('Room ID and Room Password are both required.');
      return;
    }

    setBusy(true);
    try {
      const result = await api.matches.publishRoom(selected.id, roomId.trim(), roomPassword.trim());
      toast.success(
        result.warning ? 'Room published — but nobody has joined yet' : `Room published for ${selected.title}`
      );
      setSeatedWarning(result.warning);
      setConfirmPublish(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not publish the room');
    } finally {
      setBusy(false);
    }
  };

  const revealNow = async () => {
    if (!selected || busy) return;
    setFormError('');
    setBusy(true);
    try {
      await api.matches.roomReveal(selected.id);
      toast.success('Room credentials are now visible to joined players');
      setSeatedWarning(null);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not reveal the room');
    } finally {
      setBusy(false);
    }
  };

  const copyAll = async () => {
    if (!selected?.room) return;
    try {
      await navigator.clipboard.writeText(
        `Room ID: ${selected.room.roomId}\nPassword: ${selected.room.roomPassword}\n${selected.title} — ${formatIST(selected.matchTime)}`
      );
      toast.success('Room credentials copied');
    } catch {
      toast.error('Could not copy — select the fields manually');
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Phase 4 · Match operations"
        title="Publish Room"
        subtitle="Publishing reveals the Room ID & Password to every joined player instantly — there is no timer."
        action={
          <AppButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />}
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </AppButton>
        }
      />

      {error && <InlineError>{error}</InlineError>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ── Match picker ───────────────────────────────────────── */}
        <GlassCard flat className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-white/[0.07] px-3.5 py-3">
            <div>
              <p className="text-[12px] font-black">Publishable matches</p>
              <p className="text-[10px] text-slate-500">Upcoming/open + 1h grace after kickoff</p>
            </div>
            <span className="rounded-md border border-slate-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-black text-slate-400">
              {matches.length}
            </span>
          </div>

          {loading ? (
            <div className="p-3">
              <LoadingState rows={3} label="Loading matches…" />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="Nothing to publish"
              description="Create a match first. Yesterday's finished matches never appear in this list."
            />
          ) : (
            <ul className="max-h-[520px] divide-y divide-slate-200 dark:divide-white/[0.06] overflow-y-auto">
              {matches.map((match) => {
                const isActive = match.id === selectedId;
                const published = Boolean(match.hasRoomCredentials && match.roomUnlocked);
                return (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => selectMatch(match.id)}
                      className={`w-full px-3.5 py-3 text-left transition-colors ${
                        isActive ? 'bg-amber-400/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-black">
                          {match.matchNumber != null ? `#${match.matchNumber} ` : ''}
                          {humanize(match.mapType)} • {humanize(match.matchType)}
                        </p>
                        <StatusBadge status={match.status} />
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">{formatIST(match.matchTime)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-slate-200 dark:border-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
                          {match.slotsBooked}/{match.totalSlots} seats
                        </span>
                        <span
                          className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                            published
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'
                              : match.hasRoomCredentials
                                ? 'border-amber-400/30 bg-amber-400/10 text-amber-600 dark:text-amber-300'
                                : 'border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] text-slate-400'
                          }`}
                        >
                          {published ? 'Room live' : match.hasRoomCredentials ? 'Room hidden' : 'No room'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-500">
                          {formatCountdown(match.matchTime)} to go
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        {/* ── Publish panel ──────────────────────────────────────── */}
        {selected ? (
          <div className="space-y-4">
            <GlassCard flat className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-black">
                    {selected.matchNumber != null ? `#${selected.matchNumber} ` : ''}
                    {humanize(selected.mapType)} • {humanize(selected.matchType)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {formatIST(selected.matchTime)} • {selected.slotsBooked}/{selected.totalSlots} seats •{' '}
                    ₹{Number(selected.entryFee)} entry
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.02] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Room state</p>
                  <p className="mt-0.5 text-[12px] font-bold">
                    {selected.hasRoomCredentials && selected.roomUnlocked ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Published — players can see it</span>
                    ) : selected.hasRoomCredentials ? (
                      <span className="text-amber-600 dark:text-amber-300">Credentials set — not revealed</span>
                    ) : (
                      <span className="text-slate-400">Room not published</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/[0.08] dark:bg-white/[0.02] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Revealed at</p>
                  <p className="mt-0.5 text-[12px] font-bold">
                    {selected.roomRevealedAt ? formatIST(selected.roomRevealedAt) : 'Not yet'}
                  </p>
                </div>
              </div>
            </GlassCard>

            {selected.hasRoomCredentials && (
              <GlassCard flat className="p-4 sm:p-5">
                <h3 className="mb-2 flex items-center gap-2 text-[13px] font-black">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-300" /> Current credentials
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CopyField label="Room ID" value={selected.room?.roomId ?? '—'} />
                  <CopyField label="Room password" value={selected.room?.roomPassword ?? '—'} masked />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <AppButton size="sm" variant="secondary" onClick={() => void copyAll()}>
                    Copy both
                  </AppButton>
                  <a
                    href={whatsappShareUrl(roomShareText(selected))}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-400/20"
                  >
                    <Send className="h-3.5 w-3.5" /> WhatsApp (staff group)
                  </a>
                  {!selected.roomUnlocked && (
                    <AppButton
                      size="sm"
                      variant="cyan"
                      loading={busy}
                      onClick={() => void revealNow()}
                    >
                      Reveal to players now
                    </AppButton>
                  )}
                </div>
              </GlassCard>
            )}

            <GlassCard flat className="p-4 sm:p-5">
              <h3 className="mb-1 flex items-center gap-2 text-[13px] font-black">
                <Radio className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
                {selected.hasRoomCredentials ? 'Update room credentials' : 'Publish room credentials'}
              </h3>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                Players receive the Room ID & Password the moment you publish — every seated player's app
                unlocks and a push notification goes out. Saving again updates the players instantly.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Room ID (code inside Free Fire)" hint="Max 64 characters">
                  <TextInput
                    value={roomId}
                    maxLength={64}
                    placeholder="e.g. 88421905"
                    onChange={(event) => setRoomId(event.target.value)}
                  />
                </Field>
                <Field label="Room password" hint="Max 64 characters">
                  <TextInput
                    value={roomPassword}
                    maxLength={64}
                    placeholder="e.g. spartan12"
                    onChange={(event) => setRoomPassword(event.target.value)}
                  />
                </Field>
              </div>

              {formError && (
                <div className="mt-3">
                  <InlineError>{formError}</InlineError>
                </div>
              )}

              {seatedWarning && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{seatedWarning}</span>
                </div>
              )}

              <div className="mt-3">
                <InfoNote>
                  Only <b>joined players</b> can see the room. If nobody has booked a seat, share the match
                  first or cancel & refund instead.
                </InfoNote>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <AppButton
                  size="md"
                  icon={<Radio className="h-4 w-4" />}
                  loading={busy}
                  disabled={!roomId.trim() || !roomPassword.trim()}
                  onClick={() => setConfirmPublish(true)}
                >
                  {selected.hasRoomCredentials ? 'Update & publish room' : 'Publish room to players'}
                </AppButton>
                <AppButton
                  size="md"
                  variant="ghost"
                  icon={<ArrowLeft className="h-4 w-4" />}
                  onClick={() => {
                    setSelectedId(null);
                    setSearchParams({}, { replace: true });
                  }}
                >
                  Back to list
                </AppButton>
              </div>
            </GlassCard>
          </div>
        ) : (
          <GlassCard flat className="flex min-h-[280px] items-center justify-center">
            <EmptyState
              icon={Radio}
              title="Select a match to publish"
              description="Pick any upcoming match on the left. Finished or cancelled matches can never receive a room."
            />
          </GlassCard>
        )}
      </div>

      <ConfirmDialog
        open={confirmPublish}
        title={selected?.hasRoomCredentials ? 'Update the published room?' : 'Publish this room to players?'}
        description={
          selected
            ? `${selected.title} — ${formatIST(selected.matchTime)}. ${
                selected.hasRoomCredentials
                  ? 'Every seated player gets the new Room ID & Password immediately.'
                  : 'Every seated player gets the Room ID & Password immediately (app unlock + push).'
              } This cannot be sent back to hidden.`
            : undefined
        }
        confirmLabel={selected?.hasRoomCredentials ? 'Update room' : 'Publish room'}
        busy={busy}
        onClose={() => setConfirmPublish(false)}
        onConfirm={() => void save()}
      >
        {selected && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.02] p-3 text-[12px]">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-500">Room ID</span>
              <span className="ml-auto font-mono font-bold">{roomId || '—'}</span>
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-500">Password</span>
              <span className="ml-auto font-mono font-bold">{roomPassword ? '•'.repeat(8) : '—'}</span>
            </p>
            <p className="text-[11px] text-slate-500">
              {selected.slotsBooked} confirmed {selected.slotsBooked === 1 ? 'player' : 'players'} will see it.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
