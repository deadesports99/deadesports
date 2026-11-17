import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Free Fire custom-room seat windows — one seat = one paying PLAYER.
 * Must match SLOT_LIMITS in backend/src/services/tournament.service.ts.
 */
const SLOT_LIMITS: Record<GameMode, { min: number; max: number; step: number }> = {
  BATTLE_ROYALE: { min: 20, max: 52, step: 1 },
  CLASH_SQUAD: { min: 2, max: 8, step: 1 },
};

/**
 * Share of entry-fee collection paid back to players as kill bounties.
 * Fallback platform cut when the tenant has not set one yet.
 * The live value comes from Tenant.commissionRate (Settings screen).
 */
const DEFAULT_COMMISSION_PERCENT = 20;
/** Mirror of MAX_COMMISSION_PERCENT in backend/src/services/tenant.service.ts. */
const MAX_CUT_PERCENT = 90;
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
  const [totalSlots, setTotalSlots] = useState(52);
  /** Raw text for the number box, so the admin can clear/type freely. */
  const [slotsText, setSlotsText] = useState('52');

  const slotLimits = SLOT_LIMITS[gameMode];
  const slotsFixed = slotLimits.min === slotLimits.max;

  /** Keep state, the typed box and the slider in sync, clamped to the mode window. */
  const applySlots = (raw: number) => {
    const next = Math.min(slotLimits.max, Math.max(slotLimits.min, Math.round(raw) || slotLimits.min));
    setTotalSlots(next);
    setSlotsText(String(next));
  };

  /** Switching BR <-> CS changes the window: snap the seat count into it. */
  const changeGameMode = (mode: GameMode) => {
    setGameMode(mode);
    const next = SLOT_LIMITS[mode];
    const clamped = Math.min(next.max, Math.max(next.min, totalSlots));
    setTotalSlots(clamped);
    setSlotsText(String(clamped));
  };

  const [entryFee, setEntryFee] = useState('');
  const [perKillPrize, setPerKillPrize] = useState('');

  // Platform cut, seeded from the tenant settings so the number the admin sees
  // here matches what the server will actually keep. Editable per match.
  const [cutPercentText, setCutPercentText] = useState(String(DEFAULT_COMMISSION_PERCENT));
  /** Last value confirmed on the server, so we only PATCH when it really moved. */
  const lastSavedCutRef = useRef(DEFAULT_COMMISSION_PERCENT);
  /** True once the admin types their own cut; auto-suggest then stops overriding. */
  const [cutTouched, setCutTouched] = useState(false);

  const [schedule, setSchedule] = useState<ScheduleDraft>(() => defaultSchedule());

  const [visibilityMode, setVisibilityMode] = useState<'ALWAYS' | 'WITHIN'>('ALWAYS');
  const [visibilityHoursText, setVisibilityHoursText] = useState('10');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Seed the cut from the tenant's saved rate. Fails silently: the admin can
  // still type a number, and the default is a safe 20%.
  useEffect(() => {
    let alive = true;
    api.settings
      .get()
      .then((settings) => {
        if (alive && typeof settings.commissionRate === 'number') {
          setCutPercentText(String(settings.commissionRate));
          lastSavedCutRef.current = settings.commissionRate;
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const fee = Number(entryFee || 0);
  const perKill = perKillPrize.trim() ? Number(perKillPrize) : undefined;

  /**
   * The admin owns the platform cut. Everything below recomputes from it, so
   * moving the percentage instantly shows what the match earns and what it
   * pays out. The server uses the same number from Tenant.commissionRate.
   */
  const cutPercent = Math.min(MAX_CUT_PERCENT, Math.max(0, Number(cutPercentText || 0)));
  const playerShare = 1 - cutPercent / 100;

  /** Cash in if every seat sells: seats x entry fee. */
  const collectedAtFull = Math.round(fee * totalSlots * 100) / 100;

  /**
   * What the lobby can actually pay out: every player but the winner can score,
   * so the worst case is (seats - 1) kills at the per-kill rate. This is the real
   * cost of the match, not the flat percentage.
   */
  const maxKills = Math.max(0, totalSlots - 1);
  const maxPayout = Math.round(maxKills * (perKill ?? 0) * 100) / 100;

  /** Kept after paying every possible kill. */
  const killProfit = Math.round((collectedAtFull - maxPayout) * 100) / 100;
  /** Kill-based margins as a share of collections, so they read like the cut. */
  const payoutPct = collectedAtFull > 0 ? (maxPayout / collectedAtFull) * 100 : 0;
  const killProfitPct = collectedAtFull > 0 ? (killProfit / collectedAtFull) * 100 : 0;

  /**
   * Suggested cut = the most you can keep while the pool still covers every
   * possible kill. Anything above this loses money, so the box starts here.
   * Adopted only while the admin has not typed a value themselves.
   */
  const safeCutPct = Math.round(killProfitPct * 10) / 10;
  const suggestedCutClamped = Math.min(MAX_CUT_PERCENT, Math.max(0, safeCutPct));

  /** Pool paid back to players at a full house. */
  const autoPool = Math.round(collectedAtFull * playerShare * 100) / 100;

  /**
   * A cut that leaves less in the pool than the kills can claim is a guaranteed
   * loss; surface the exact shortfall instead of hiding it.
   */
  const poolShortfall = Math.round((maxPayout - autoPool) * 100) / 100;

  /**
   * Auto-fill the cut from the kill maths until the admin overrides it. Entry
   * fee or per-kill changes re-run the suggestion, so the box never lags behind
   * the numbers beside it.
   */
  useEffect(() => {
    if (cutTouched || fee <= 0 || perKill === undefined) {
      return;
    }
    setCutPercentText(String(suggestedCutClamped));
  }, [fee, perKill, suggestedCutClamped, cutTouched]);

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
    perKill !== undefined &&
    Number.isFinite(perKill) &&
    perKill > 0;

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
      setError('Entry fee must be zero or more and the per-kill prize must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      // The cut lives on the tenant, so persist it before creating the match.
      // Without this the admin's number would only affect the preview.
      if (cutPercent !== lastSavedCutRef.current) {
        await api.settings.update({ commissionRate: cutPercent });
        lastSavedCutRef.current = cutPercent;
      }

      const created = await api.matches.create({
        gameMode,
        matchType,
        mapType,
        entryFee: fee,
        prizePool: autoPool,
        perKillPrize: perKill ?? 0,
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
        className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white"
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
              <Sparkles className="h-4 w-4 text-amber-800 dark:text-amber-300" /> Match format
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Game mode">
                <SelectField value={gameMode} onChange={(event) => changeGameMode(event.target.value as GameMode)}>
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
              <Field
                label="Players (slots)"
                hint={
                  slotsFixed
                    ? `This mode is fixed at ${slotLimits.max} players.`
                    : `Slide or type: ${slotLimits.min}–${slotLimits.max} players. One slot = one paying player.`
                }
              >
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={slotLimits.min}
                    max={slotLimits.max}
                    step={slotLimits.step}
                    value={totalSlots}
                    disabled={slotsFixed}
                    onChange={(event) => applySlots(Number(event.target.value))}
                    aria-label="Players / slots"
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-300 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/15"
                  />
                  <TextInput
                    inputMode="numeric"
                    value={slotsText}
                    disabled={slotsFixed}
                    aria-label="Players / slots (type a number)"
                    className="w-20 text-center"
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^\d]/g, '').slice(0, 3);
                      setSlotsText(raw);
                      if (raw !== '') applySlots(Number(raw));
                    }}
                    onBlur={() => applySlots(totalSlots)}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[12.5px] font-semibold text-slate-600 dark:text-slate-400">
                  <span>{slotLimits.min}</span>
                  <span className="text-emerald-700 dark:text-emerald-300">{totalSlots} players</span>
                  <span>{slotLimits.max}</span>
                </div>
              </Field>
            </div>
          </GlassCard>

          {/* ── Money ──────────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[13px] font-black">
              <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" /> Entry & prizes
            </h3>

            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Entry fee (₹) *">
                <TextInput
                  inputMode="decimal"
                  value={entryFee}
                  placeholder="0"
                  onChange={(event) => setEntryFee(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
              <Field label="Per-kill prize (₹) *">
                <TextInput
                  inputMode="decimal"
                  value={perKillPrize}
                  placeholder="0"
                  onChange={(event) => setPerKillPrize(event.target.value.replace(/[^\d.]/g, '').slice(0, 8))}
                />
              </Field>
              <Field label={cutTouched ? 'Your cut (%)' : 'Your cut (%) — auto'}>
                <TextInput
                  inputMode="decimal"
                  value={cutPercentText}
                  placeholder={String(DEFAULT_COMMISSION_PERCENT)}
                  aria-label="Platform cut percent"
                  onChange={(event) => {
                    setCutTouched(true);
                    const raw = event.target.value.replace(/[^\d.]/g, '').slice(0, 5);
                    // Clamp on the way in so the box always shows what the match
                    // will really use; the server enforces the same 0-90 range.
                    const n = Number(raw);
                    setCutPercentText(raw === '' ? '' : String(Math.min(MAX_CUT_PERCENT, Math.max(0, n))));
                  }}
                />
              </Field>
              <Field label="Pool if full house (₹)">
                <TextInput
                  value={autoPool ? String(autoPool) : '0'}
                  readOnly
                  disabled
                  aria-label="Prize pool (auto-calculated)"
                  className="cursor-not-allowed opacity-70"
                />
              </Field>
            </div>

            {/* Live money split — moves the moment any number above changes. */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MoneyCell label="Collected (full house)" value={collectedAtFull} tone="plain" />
              <MoneyCell
                label={`Max payout (${maxKills} kills)`}
                value={maxPayout}
                tone="plain"
                hint={`${payoutPct.toFixed(1)}% of collections`}
              />
              <MoneyCell
                label="Your profit (auto)"
                value={killProfit}
                tone={killProfit >= 0 ? 'profit' : 'loss'}
                hint={`${killProfitPct.toFixed(1)}% margin`}
              />
              <MoneyCell
                label="Per seat profit"
                value={Math.round((fee - (maxPayout / (totalSlots || 1))) * 100) / 100}
                tone="plain"
              />
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <InfoNote>
                Kill maths: worst case is <b>{maxKills}</b> kills x <b>₹{perKill ?? 0}</b> =
                <b> ₹{maxPayout.toFixed(2)}</b> paid out, so you keep
                <b> ₹{killProfit.toFixed(2)}</b> ({killProfitPct.toFixed(1)}%) of
                <b> ₹{collectedAtFull.toFixed(2)}</b>.
              </InfoNote>
              <InfoNote>
                The match starts at <b>₹0</b> — nobody has paid yet. Every join adds{' '}
                <b>₹{(fee * playerShare).toFixed(2)}</b> to the pool ({100 - cutPercent}% of the fee), so
                a full house of <b>{totalSlots}</b> seats reaches{' '}
                <b>₹{autoPool.toFixed(2)}</b>. Your cut is{' '}
                <b>{cutTouched ? cutPercent : suggestedCutClamped}%</b>
                {cutTouched ? ' (your override)' : ' (auto = most you can keep safely)'}.
              </InfoNote>
              {poolShortfall > 0 ? (
                <div className="rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200">
                  Loss alert: at <b>{cutPercent}%</b> the pool is ₹{autoPool.toFixed(2)} but{' '}
                  <b>{maxKills}</b> kills would need ₹{maxPayout.toFixed(2)} — short by{' '}
                  <b>₹{poolShortfall.toFixed(2)}</b>. Lower your cut to{' '}
                  <b>{suggestedCutClamped}%</b> or less.
                </div>
              ) : (
                <InfoNote>
                  Safe: the ₹{autoPool.toFixed(2)} pool still covers the worst case of{' '}
                  <b>{maxKills}</b> kills (₹{maxPayout.toFixed(2)}), leaving
                  <b> ₹{(autoPool - maxPayout).toFixed(2)}</b>.
                </InfoNote>
              )}
              <InfoNote>
                Pure per-kill format: no 1st/2nd/3rd prize. Every confirmed kill pays
                <b> ₹{perKill ?? 0}</b>, so a player's payout is simply kills × ₹{perKill ?? 0}.
              </InfoNote>
            </div>
          </GlassCard>

          {/* ── Schedule ───────────────────────────────────────────── */}
          <GlassCard flat className="p-4 sm:p-5">
            <h3 className="mb-1 flex items-center gap-2 text-[13px] font-black">
              <Clock className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> Match schedule (IST)
            </h3>
            <p className="mb-3 text-[12.5px] text-slate-600 dark:text-slate-400">
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
                  <span className="text-slate-600 dark:text-slate-400">:</span>
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
                          'h-11 px-2.5 text-[12.5px] font-black transition-colors sm:h-10',
                          schedule.meridiem === meridiem
                            ? 'bg-[#FFD000] text-slate-950'
                            : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
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
              <span className="text-[11.5px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Quick schedule:</span>
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
              <p className={cx('text-[12px] font-black', matchInFuture ? 'text-amber-800 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300')}>
                ⏰ Match starts: {draftPreview(schedule)} IST
              </p>
              <p className={cx('mt-0.5 text-[12.5px]', matchInFuture ? 'text-slate-600 dark:text-slate-400' : 'text-rose-700 dark:text-rose-300')}>
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
            <p className="mb-3 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
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
                    <p className="mt-0.5 text-[12.5px] text-slate-600 dark:text-slate-400">
                      {windowAlreadyOpen
                        ? 'This window has already opened — the match will be visible immediately.'
                        : `Hidden until then • ${formatCountdown(visibleFromIso)} from now (${parsedVisibilityHours} hours before kickoff).`}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
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
            <p className="text-[11.5px] font-black uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">Preview</p>
            <p className="mt-1 text-[15px] font-black">{mapType.charAt(0) + mapType.slice(1).toLowerCase()} {matchType}</p>
            <p className="text-[12.5px] text-slate-600 dark:text-slate-400">Match number assigned on save</p>

            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Kickoff</dt>
                <dd className="text-right font-bold">{draftPreview(schedule)} IST</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Countdown</dt>
                <dd className="font-bold text-amber-800 dark:text-amber-300">{matchInFuture ? formatCountdown(matchIso) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Entry</dt>
                <dd className="font-bold">₹{fee || 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Pool (full house)</dt>
                <dd className="font-bold">₹{autoPool || 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Per kill</dt>
                <dd className="font-bold">₹{perKill ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Seats</dt>
                <dd className="font-bold">{totalSlots}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600 dark:text-slate-400">Player list</dt>
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

/**
 * One money number in the live split strip. `tone` colours the value so the
 * admin can read "what I keep" at a glance without parsing labels.
 */
function MoneyCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'plain' | 'good' | 'profit' | 'loss';
  hint?: string;
}) {
  const valueClass =
    tone === 'loss'
      ? 'text-rose-700 dark:text-rose-300'
      : tone === 'profit'
        ? 'text-emerald-700 dark:text-emerald-300'
        : tone === 'good'
          ? 'text-cyan-700 dark:text-cyan-300'
          : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/60 px-2.5 py-2 dark:border-white/10 dark:bg-white/5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`text-[15px] font-black tabular-nums ${valueClass}`}>
        ₹{(Number.isFinite(value) ? value : 0).toFixed(2)}
      </div>
      {hint ? (
        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{hint}</div>
      ) : null}
    </div>
  );
}
