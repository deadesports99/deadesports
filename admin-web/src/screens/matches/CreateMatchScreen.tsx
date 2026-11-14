import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Clock, Eye, ShieldCheck, Sparkles } from 'lucide-react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../components/common/Toast';
import { GlassCard } from '../../components/common/GlassCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { AppButton } from '../../components/common/AppButton';
import { formatCountdown, formatIST, cx } from '../../lib/format';
import {
  draftPreview,
  isDraftInFuture,
  defaultSchedule,
  scheduleToIso,
  shiftSchedule,
  type Meridiem,
  type ScheduleDraft,
} from '../../lib/istTime';
import { Chip, Field, InfoNote, InlineError, SelectField, TextInput } from './MatchFormBits';
import type { GameMode, MapType, MatchType } from '../../types';

const MAPS: MapType[] = ['BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE', 'NEXTERRA'];
const MODES: GameMode[] = ['BATTLE_ROYALE', 'CLASH_SQUAD'];
const TYPES: MatchType[] = ['SOLO', 'DUO', 'SQUAD'];
const SEAT_OPTIONS = [12, 16, 24, 36, 48];
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const QUICK_HOURS = [1, 3, 6, 12, 24];
const VISIBILITY_PRESETS = ['2', '6', '10', '12', '24'];

/**
 * Create Match — the browser twin of the Android admin form.
 *
 * No title field: the backend assigns the next match number and generates
 * "<Map> <Type> #N". Time is entered in IST with a 12-hour AM/PM picker and the
 * console shows exactly when the match starts and when players first see it.
 */
export function CreateMatchScreen() {
  const navigate = useNavigate();
  const toast = useToast();

  const [gameMode, setGameMode] = useState<GameMode>('BATTLE_ROYALE');
  const [matchType, setMatchType] = useState<MatchType>('SOLO');
  const [mapType, setMapType] = useState<MapType>('BERMUDA');
  const [totalSlots, setTotalSlots] = useState(48);

  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [perKillPrize, setPerKillPrize] = useState('');

  const [schedule, setSchedule] = useState<ScheduleDraft>(() => defaultSchedule());

  const [visibilityMode, setVisibilityMode] = useState<'ALWAYS' | 'WITHIN'>('ALWAYS');
  const [visibilityHoursText, setVisibilityHoursText] = useState('10');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fee = Number(entryFee || 0);
  const pool = Number(prizePool || 0);
  const perKill = perKillPrize.trim() ? Number(perKillPrize) : undefined;

  const matchIso = useMemo(() => scheduleToIso(schedule), [schedule]);
  const matchInFuture = isDraftInFuture(schedule);

  const parsedVisibilityHours = Number(visibilityHoursText);
  const visibilityValid =
    visibilityMode === 'ALWAYS' ||
    (Number.isInteger(parsedVisibilityHours) &&
      parsedVisibilityHours >= 1 &&
      parsedVisibilityHours <= 336);

  const visibleFromIso =
    visibilityMode === 'WITHIN' && visibilityValid
      ? new Date(new Date(matchIso).getTime() - parsedVisibilityHours * 3_600_000).toISOString()
      : null;
  const windowAlreadyOpen = visibleFromIso ? new Date(visibleFromIso).getTime() <= Date.now() : false;

  const numbersValid =
    Number.isFinite(fee) &&
    fee >= 0 &&
    Number.isFinite(pool) &&
    pool >= 0 &&
    (perKill === undefined || (Number.isFinite(perKill) && perKill >= 0));

  const canSubmit = !submitting && numbersValid && matchInFuture && visibilityValid;

  const setHour = (hour12: number) => setSchedule((draft) => ({ ...draft, hour12 }));
  const setMinute = (minute: number) => setSchedule((draft) => ({ ...draft, minute }));
  const setMeridiem = (meridiem: Meridiem) => setSchedule((draft) => ({ ...draft, meridiem }));
  const setDate = (date: string) => setSchedule((draft) => ({ ...draft, date }));

  const applyQuickHours = (hours: number) => {
    setSchedule((draft) => shiftSchedule(draft, hours));
    setError('');
  };

  const submit = async () => {
    if (submitting) return;
    setError('');

    if (!matchInFuture) {
      setError('Match time must be in the future (IST).');
      return;
    }
    if (!visibilityValid) {
      setError('Visibility window must be between 1 and 336 hours.');
      return;
    }
    if (!numbersValid) {
      setError('Entry fee, prize pool and per-kill must be zero or more.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.matches.create({
        gameMode,
        matchType,
        mapType,
        entryFee: fee,
        prizePool: pool,
        ...(perKill !== undefined && perKill > 0 ? { perKillPrize: perKill } : {}),
        matchTime: matchIso,
        totalSlots,
        visibilityHours: visibilityMode === 'ALWAYS' ? null : parsedVisibilityHours,
      });

      toast.success(
        `${created.matchNumber != null ? `#${created.matchNumber} ` : ''}${created.title} created`
      );
      navigate('/matches');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the match — try again');
    } finally {
      setSubmitting(false);
    }
  };

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
        eyebrow="Phase 4 · Match operations"
        title="Create Match"
        subtitle="Match number and title are generated automatically from the map + mode."
        action={
          <AppButton variant="secondary" size="sm" icon={<CalendarClock className="h-4 w-4" />} onClick={() => navigate('/matches')}>
            Matches
          </AppButton>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* ── Format ─────────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-black">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-300" /> Match format
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Game mode">
                <SelectField value={gameMode} onChange={(event) => setGameMode(event.target.value as GameMode)}>
                  {MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode === 'BATTLE_ROYALE' ? 'Battle Royale' : 'Clash Squad'}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label="Match type">
                <SelectField value={matchType} onChange={(event) => setMatchType(event.target.value as MatchType)}>
                  {TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field label="Map">
                <SelectField value={mapType} onChange={(event) => setMapType(event.target.value as MapType)}>
                  {MAPS.map((map) => (
                    <option key={map} value={map}>
                      {map.charAt(0) + map.slice(1).toLowerCase()}
                    </option>
                  ))}
                </SelectField>
              </Field>
            </div>

            <div className="mt-3">
              <Field label="Total slots" hint="Backend cap is 48 seats.">
                <div className="flex flex-wrap gap-2">
                  {SEAT_OPTIONS.map((seats) => (
                    <Chip key={seats} active={totalSlots === seats} onClick={() => setTotalSlots(seats)}>
                      {seats} seats
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </GlassCard>

          {/* ── Money ──────────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-black">
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /> Entry & prizes
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Entry fee (₹)">
                <TextInput
                  inputMode="decimal"
                  value={entryFee}
                  placeholder="0"
                  onChange={(event) => setEntryFee(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
              <Field label="Prize pool (₹)">
                <TextInput
                  inputMode="decimal"
                  value={prizePool}
                  placeholder="0"
                  onChange={(event) => setPrizePool(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
              <Field label="Per-kill prize (₹, optional)">
                <TextInput
                  inputMode="decimal"
                  value={perKillPrize}
                  placeholder="0"
                  onChange={(event) => setPerKillPrize(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <InfoNote>
                Players pay <b>₹{fee || 0}</b> to join. Max payout per match is the prize pool
                <b> ₹{pool || 0}</b> — the server refuses anything above it.
              </InfoNote>
              <InfoNote>
                Rank prizes: 1st 50%, 2nd 30%, 3rd 20% of the pool. Kills pay
                <b> ₹{perKill ?? 0}</b> each on top (the roster screen previews it live).
              </InfoNote>
            </div>
          </GlassCard>

          {/* ── Schedule ───────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-1 flex items-center gap-2 text-[13px] font-black">
              <Clock className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> Match schedule (IST)
            </h3>
            <p className="mb-3 text-[11px] text-slate-500">
              Always India Standard Time with a 12-hour AM/PM picker — the browser time zone is ignored.
            </p>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Field label="Match date">
                <TextInput type="date" value={schedule.date} onChange={(event) => setDate(event.target.value)} />
              </Field>
              <Field label="Match time">
                <div className="flex items-center gap-1.5">
                  <SelectField
                    aria-label="Hour"
                    value={schedule.hour12}
                    onChange={(event) => setHour(Number(event.target.value))}
                  >
                    {HOURS.map((hour) => (
                      <option key={hour} value={hour}>
                        {String(hour).padStart(2, '0')}
                      </option>
                    ))}
                  </SelectField>
                  <span className="text-slate-500">:</span>
                  <SelectField
                    aria-label="Minute"
                    value={schedule.minute}
                    onChange={(event) => setMinute(Number(event.target.value))}
                  >
                    {[...new Set([...MINUTES, schedule.minute])].sort((a, b) => a - b).map((minute) => (
                      <option key={minute} value={minute}>
                        {String(minute).padStart(2, '0')}
                      </option>
                    ))}
                  </SelectField>
                  <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    {(['AM', 'PM'] as Meridiem[]).map((meridiem) => (
                      <button
                        key={meridiem}
                        type="button"
                        onClick={() => setMeridiem(meridiem)}
                        className={cx(
                          'h-11 px-2.5 text-[11px] font-black transition-colors sm:h-10',
                          schedule.meridiem === meridiem
                            ? 'bg-[#FFD000] text-slate-950'
                            : 'bg-transparent text-slate-400 hover:text-slate-950 dark:hover:text-white'
                        )}
                      >
                        {meridiem}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quick schedule:</span>
              {QUICK_HOURS.map((hours) => (
                <Chip key={hours} onClick={() => applyQuickHours(hours)}>
                  +{hours}h
                </Chip>
              ))}
            </div>

            <div
              className={cx(
                'mt-3 rounded-xl border px-3 py-2.5',
                matchInFuture ? 'border-[#FFD000]/30 bg-[#FFD000]/[0.06]' : 'border-rose-400/40 bg-rose-500/10'
              )}
            >
              <p className={cx('text-[12px] font-black', matchInFuture ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300')}>
                ⏰ Match starts: {draftPreview(schedule)} IST
              </p>
              <p className={cx('mt-0.5 text-[11px]', matchInFuture ? 'text-slate-400' : 'text-rose-600 dark:text-rose-300')}>
                {matchInFuture
                  ? `Starts in about ${formatCountdown(matchIso)} (IST).`
                  : '❌ Match time must be in the future.'}
              </p>
            </div>
          </GlassCard>

          {/* ── Visibility ─────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-1 flex items-center gap-2 text-[13px] font-black">
              <Eye className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> Player list visibility
            </h3>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
              You decide when players can see this match in their list. Tip: a match 12 hours away with a
              10-hour window stays hidden until 10 hours remain. Players who already joined always keep
              seeing their match.
            </p>

            <div className="flex flex-wrap gap-2">
              <Chip active={visibilityMode === 'ALWAYS'} onClick={() => setVisibilityMode('ALWAYS')}>
                Always visible
              </Chip>
              <Chip active={visibilityMode === 'WITHIN'} onClick={() => setVisibilityMode('WITHIN')}>
                Only near start
              </Chip>
            </div>

            {visibilityMode === 'WITHIN' ? (
              <div className="mt-3 space-y-3">
                <Field
                  label="Show in list this many hours before start"
                  hint="Between 1 and 336 hours (14 days)."
                  error={visibilityValid ? undefined : 'Enter 1 to 336 hours'}
                >
                  <TextInput
                    inputMode="numeric"
                    value={visibilityHoursText}
                    placeholder="10"
                    onChange={(event) => setVisibilityHoursText(event.target.value.replace(/\D/g, '').slice(0, 3))}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  {VISIBILITY_PRESETS.map((preset) => (
                    <Chip
                      key={preset}
                      active={visibilityHoursText === preset}
                      onClick={() => setVisibilityHoursText(preset)}
                    >
                      {preset}h
                    </Chip>
                  ))}
                </div>

                {visibleFromIso && (
                  <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-2.5">
                    <p className="text-[12px] font-black text-cyan-800 dark:text-cyan-200">
                      👁 Players see this match from: {formatIST(visibleFromIso)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {windowAlreadyOpen
                        ? 'This window has already opened — the match will be visible immediately.'
                        : `Hidden until then • ${formatCountdown(visibleFromIso)} from now (${parsedVisibilityHours} hours before kickoff).`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[12px] font-semibold text-amber-600 dark:text-amber-300">
                👁 Players can see this match in their list right after it is created.
              </p>
            )}

            <div className="mt-3">
              <InfoNote>
                🔑 Room ID & Password are not part of creation. After saving, open <b>Publish Room</b> to set
                the code, its password and reveal it to joined players.
              </InfoNote>
            </div>
          </GlassCard>

          {error && <InlineError>{error}</InlineError>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <AppButton
              size="lg"
              loading={submitting}
              disabled={!canSubmit}
              onClick={() => void submit()}
              className="sm:min-w-[220px]"
            >
              {submitting ? 'Creating…' : 'Create Tournament'}
            </AppButton>
            <AppButton size="lg" variant="secondary" onClick={() => navigate('/matches')} disabled={submitting}>
              Cancel
            </AppButton>
          </div>
        </div>

        {/* ── Live preview ────────────────────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <GlassCard flat className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Preview</p>
            <p className="mt-1 text-[15px] font-black">{mapType.charAt(0) + mapType.slice(1).toLowerCase()} {matchType}</p>
            <p className="text-[11px] text-slate-500">Match number assigned on save</p>

            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Kickoff</dt>
                <dd className="text-right font-bold">{draftPreview(schedule)} IST</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Countdown</dt>
                <dd className="font-bold text-amber-600 dark:text-amber-300">{matchInFuture ? formatCountdown(matchIso) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Entry</dt>
                <dd className="font-bold">₹{fee || 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Prize pool</dt>
                <dd className="font-bold">₹{pool || 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Per kill</dt>
                <dd className="font-bold">₹{perKill ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Seats</dt>
                <dd className="font-bold">{totalSlots}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Player list</dt>
                <dd className="text-right font-bold">
                  {visibilityMode === 'ALWAYS' ? 'Always visible' : `Last ${visibilityHoursText || 0}h`}
                </dd>
              </div>
            </dl>
          </GlassCard>

          <div className="hidden xl:block">
            <InfoNote>
              After creating, use <b>Publish Room</b> for Room ID/password and <b>Live Scorer</b> after kickoff
              to rank players and pay prizes.
            </InfoNote>
          </div>
        </div>
      </div>
    </div>
  );
}
