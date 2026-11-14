import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { can } from '../lib/permissions';
import { useTheme } from '../lib/theme';
import { cx } from '../lib/format';
import { GlassCard } from '../components/common/GlassCard';
import { AppButton } from '../components/common/AppButton';
import { useSession } from '../context/SessionContext';

interface PlaceholderCopy {
  title: string;
  phase: number;
  summary: string;
  bullets: string[];
}

/**
 * Honest placeholder for screens that land in Phase 4–5. It shows what is
 * being built next instead of a broken or fake screen.
 */
const COPY: Array<{ test: RegExp; copy: PlaceholderCopy }> = [
  {
    test: /^\/matches\/create/,
    copy: {
      title: 'Create Match',
      phase: 4,
      summary: 'Naya match banane ka full form — backend already supports it.',
      bullets: [
        'Map, mode, slots (12–48), entry fee, prize pool and per-kill',
        'IST date/time picker with live preview and +1h/+3h/+6h/+24h chips',
        'Visibility window and room reveal window',
        'Auto match number — no manual title field',
      ],
    },
  },
  {
    test: /^\/matches\/publish/,
    copy: {
      title: 'Publish Room',
      phase: 4,
      summary: 'Room ID + password publish karke players ko reveal karo.',
      bullets: [
        'Publishable matches (with 1h grace) and empty state',
        'Room credentials, reveal timing chips and "Reveal now"',
        'Copy / WhatsApp share text for staff',
      ],
    },
  },
  {
    test: /^\/matches/,
    copy: {
      title: 'Matches',
      phase: 4,
      summary: 'LIVE / UPCOMING / HISTORY — poora match control ek jagah.',
      bullets: [
        'Status, seats, entry, prize pool and room state on every card',
        'Clone, cancel & refund, visibility and reveal dialogs',
        'Lifecycle sweep ("Sweep now") with result summary',
      ],
    },
  },
  {
    test: /^\/(roster|scorer)/,
    copy: {
      title: 'Live Scorer & Roster',
      phase: 4,
      summary: 'Canonical payout flow — per-player rank, kills, DQ aur prize.',
      bullets: [
        'LIVE + unscored backlog tabs with search',
        'Participant table: slot, IGN, FF UID, rank, kills, reward preview',
        'Bulk actions, CSV export, ban-from-roster',
        'Double-submit safe "Save results & complete match"',
      ],
    },
  },
  {
    test: /^\/wallet\/settlement/,
    copy: {
      title: 'Daily Settlement',
      phase: 5,
      summary: 'Owner-only P&L — collections, payouts, prizes aur margin.',
      bullets: [
        'IST date picker and KPI summary',
        'Transaction table with filters',
        'CSV export via the cookie-authenticated endpoint',
      ],
    },
  },
  {
    test: /^\/wallet/,
    copy: {
      title: 'Wallet Console',
      phase: 5,
      summary: 'Withdrawals, deposits aur online payments ki queue.',
      bullets: [
        'Withdrawal approve (UTR) / reject with reason',
        'Deposit verification queue',
        'Online payments summary + one-tap sync',
        'Row-level busy states and double-approve protection',
      ],
    },
  },
  {
    test: /^\/players\/watchlist/,
    copy: {
      title: 'Watchlist',
      phase: 5,
      summary: 'Watched devices, new-account alerts aur acknowledge.',
      bullets: ['Alerts by device', 'Acknowledge reviewed alerts', 'Unwatch a clean device'],
    },
  },
  {
    test: /^\/players\/devices/,
    copy: {
      title: 'Device Groups',
      phase: 5,
      summary: 'Ek device par multiple accounts — risk ke saath rank kiya hua.',
      bullets: ['Accounts per device', 'Matching history between accounts', 'Ban device + CSV export'],
    },
  },
  {
    test: /^\/players\/suspicious/,
    copy: {
      title: 'Suspicious Players',
      phase: 5,
      summary: 'Device farm / net-positive / spike signals ke saath ranked list.',
      bullets: ['Score threshold slider', 'Ranked accounts', 'Jump into player detail'],
    },
  },
  {
    test: /^\/players/,
    copy: {
      title: 'Players',
      phase: 5,
      summary: 'Search, history, wallet preview, ban / unban.',
      bullets: [
        'Search by Player ID, phone, IGN or FF UID',
        'Career stats and match history',
        'Instant ban with reason',
      ],
    },
  },
  {
    test: /^\/staff/,
    copy: {
      title: 'Staff & Access',
      phase: 5,
      summary: '24-character permission keys — generate once, revoke instantly.',
      bullets: [
        'Staff list with permission chips and key status',
        'Generate access dialog (key shown exactly once)',
        'Revoke / regenerate with audit trail',
      ],
    },
  },
  {
    test: /^\/settings/,
    copy: {
      title: 'App Settings',
      phase: 5,
      summary: 'UPI ID, support number, min deposit and login toggles.',
      bullets: ['Live branding fields', 'Payment config', 'Auth method switches'],
    },
  },
];

export function PlaceholderScreen() {
  const isDark = useTheme() === 'dark';
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSession();
  const entry = COPY.find((item) => item.test.test(location.pathname));
  const copy: PlaceholderCopy = entry?.copy ?? {
    title: 'Coming next',
    phase: 4,
    summary: 'This screen is part of the next build phase.',
    bullets: [],
  };

  return (
    <div className="mx-auto max-w-2xl">
      <GlassCard className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border',
              isDark ? 'border-amber-400/25 bg-amber-400/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'
            )}
          >
            <Construction className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className={cx('text-[10px] font-black uppercase tracking-[0.2em]', isDark ? 'text-slate-500' : 'text-slate-500')}>
              Phase {copy.phase} · next build
            </p>
            <h2 className={cx('mt-1 text-lg font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}>
              {copy.title}
            </h2>
            <p className={cx('mt-1 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {copy.summary}
            </p>
          </div>
        </div>

        {copy.bullets.length > 0 && (
          <ul className={cx('mt-5 space-y-2 rounded-xl border p-3.5', isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-slate-200 bg-slate-50')}>
            {copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className={cx('mt-1.5 h-1 w-1 shrink-0 rounded-full', isDark ? 'bg-amber-300' : 'bg-amber-600')} />
                <span className={cx('text-[11.5px] leading-snug', isDark ? 'text-slate-300' : 'text-slate-700')}>
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <AppButton variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/')}>
            Back to dashboard
          </AppButton>
          {can(user, 'canCreateMatch') ? (
            <AppButton onClick={() => navigate('/matches/create')}>Create a match</AppButton>
          ) : (
            <AppButton onClick={() => navigate('/matches')}>See existing matches</AppButton>
          )}
        </div>

        <p className={cx('mt-4 text-[10px] leading-relaxed', isDark ? 'text-slate-500' : 'text-slate-500')}>
          Backend endpoints for this screen already exist and are tested. The UI is scheduled
          after Phase 3 (shell, login, dashboard) is signed off.
        </p>
      </GlassCard>
    </div>
  );
}
