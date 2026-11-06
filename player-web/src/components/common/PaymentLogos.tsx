import React from 'react';
import { cx } from '../../utils/formatters';

interface UpiStackProps {
  isDark: boolean;
}

// --- Official Logos (PhonePe, GPay, Paytm, BHIM UPI) ---

export function PhonePeLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="11.5" fill="#FFFFFF" />
      <path
        fill="#5F259F"
        fillRule="evenodd"
        d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243C1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433m-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z"
      />
    </svg>
  );
}

export function GPayLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12.24 10.285V14.4h6.012c-.26 1.365-1.045 2.52-2.22 3.3l3.585 2.775c2.085-1.92 3.285-4.755 3.285-8.19 0-.795-.075-1.56-.21-2.28H12.24z"
        fill="#4285F4"
      />
      <path
        d="M6.3 14.745l-.975.75-2.655 2.07C4.38 20.94 7.965 23 12.24 23c3.24 0 5.955-1.065 7.935-2.895l-3.585-2.775c-1.08.72-2.46 1.155-4.35 1.155-3.33 0-6.15-2.25-7.155-5.325l-.785.585z"
        fill="#34A853"
      />
      <path
        d="M2.67 17.565A10.97 10.97 0 011.5 12c0-1.965.54-3.81 1.5-5.4l3.3 2.565A6.98 6.98 0 005.76 12c0 1.005.225 1.95.63 2.805l-3.72 2.76z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 5.52c1.785 0 3.39.615 4.65 1.815l3.48-3.48C18.285 1.92 15.48.5 12.24.5 7.965.5 4.38 2.565 2.67 6.6l3.69 2.865c1.005-3.075 3.825-5.325 7.155-5.325l-1.275.64z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function PaytmLogo({ className = 'h-5 w-auto' }: { className?: string }) {
  return (
    <img
      src="/assets/logos/paytm.svg"
      alt="Paytm"
      className={cx('object-contain', className)}
    />
  );
}

export function PaytmIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <div className={cx('flex items-center justify-center bg-white rounded-lg p-0.5 overflow-hidden', className)}>
      <img
        src="/assets/logos/paytm.svg"
        alt="Paytm"
        className="w-full h-auto object-contain"
      />
    </div>
  );
}

export function BhimUpiLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M6 18l5-6-5-6h3.5l5 6-5 6H6z" fill="#097939" />
      <path d="M12 18l5-6-5-6h3.5l5 6-5 6H12z" fill="#ED7524" />
    </svg>
  );
}

export function UpiStack({ isDark }: UpiStackProps) {
  // Border colors requested by user: "dark me white aur lite me black"
  const ringBorder = isDark ? 'ring-1.5 ring-white/30 border border-white/20' : 'ring-1.5 ring-black/25 border border-black/15';

  return (
    <div className="flex items-center gap-2.5">
      {/* 5 Overlapping Circles Stack (Accurate Official Indian UPI Logos) */}
      <div className="flex -space-x-1.5 overflow-hidden py-0.5">
        {/* 1. PhonePe (Official Purple Circle with white 'पे') */}
        <div
          title="PhonePe UPI"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-[#5F259F] overflow-hidden p-0.5',
            ringBorder
          )}
        >
          <PhonePeLogo className="h-full w-full" />
        </div>

        {/* 2. Google Pay (White Circle with official 4-color G-Logo) */}
        <div
          title="Google Pay"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-white',
            ringBorder
          )}
        >
          <GPayLogo className="h-3.5 w-3.5" />
        </div>

        {/* 3. Paytm (Official downloaded Wikimedia SVG) */}
        <div
          title="Paytm UPI"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-white p-0.5 overflow-hidden',
            ringBorder
          )}
        >
          <img
            src="/assets/logos/paytm.svg"
            alt="Paytm"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* 4. Official NPCI UPI (White Circle with Green & Orange Arrows + bold 'UPI' text) */}
        <div
          title="NPCI UPI (Unified Payments Interface)"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-white p-0.5',
            ringBorder
          )}
        >
          <BhimUpiLogo className="h-3.5 w-3.5" />
        </div>

        {/* 5. WhatsApp Pay (Official Vibrant Green with white phone icon) */}
        <div
          title="WhatsApp Pay"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-[#25D366]',
            ringBorder
          )}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.48-8.413z" />
          </svg>
        </div>
      </div>

      {/* Label next to stack */}
      <div className="flex flex-col">
        <span
          className={cx(
            'text-[9px] font-black uppercase tracking-wider',
            isDark ? 'text-slate-200' : 'text-slate-900'
          )}
        >
          Instant UPI
        </span>
        <span
          className={cx(
            'text-[8px] font-semibold leading-none',
            isDark ? 'text-slate-400' : 'text-slate-600'
          )}
        >
          All Apps Supported
        </span>
      </div>
    </div>
  );
}

// --- Individual Brand & Esports Badges for Ledger & Passbook ---

export function PhonePeBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="PhonePe"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#5F259F] shadow-sm overflow-hidden p-1',
        isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-slate-900/10'
      )}
    >
      <PhonePeLogo className="h-full w-full" />
    </div>
  );
}

export function PaytmBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="Paytm"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm overflow-hidden p-1',
        isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-slate-900/15'
      )}
    >
      <img
        src="/assets/logos/paytm.svg"
        alt="Paytm"
        className="w-full h-auto object-contain"
      />
    </div>
  );
}

export function GPayBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="Google Pay"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm',
        isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-slate-900/15'
      )}
    >
      <GPayLogo className="h-4.5 w-4.5" />
    </div>
  );
}

export function BankBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="Bank IMPS Transfer"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm',
        isDark ? 'bg-indigo-950/80 text-indigo-400 ring-1 ring-indigo-500/30' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </div>
  );
}

export function FreeFireWinBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="Free Fire Match Won"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#081326] shadow-sm select-none transition-transform hover:scale-105',
        isDark
          ? 'ring-1.5 ring-amber-400/90 shadow-amber-500/20 shadow-md'
          : 'ring-1.5 ring-amber-500 shadow-amber-500/30 shadow-md'
      )}
    >
      <img
        src="/assets/games/freefire/icon.png"
        alt="Free Fire"
        className="h-full w-full rounded-xl object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/logos/free_fire_app_icon_512.png';
        }}
      />

      {/* Golden Crown/Trophy indicator - strictly inside the logo, bottom-right */}
      <div
        className={cx(
          'absolute bottom-0.5 right-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-sm',
          isDark ? 'ring-1 ring-[#081326]' : 'ring-1 ring-white'
        )}
      >
        <svg viewBox="0 0 24 24" className="h-2 w-2 fill-current">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
    </div>
  );
}

export function FreeFireCombatBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="Free Fire Match Entry"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#081326] shadow-sm select-none transition-transform hover:scale-105',
        isDark
          ? 'ring-1.5 ring-cyan-400/80 shadow-cyan-500/20 shadow-md'
          : 'ring-1.5 ring-cyan-600 shadow-cyan-600/20 shadow-md'
      )}
    >
      <img
        src="/assets/games/freefire/icon.png"
        alt="Free Fire"
        className="h-full w-full rounded-xl object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/logos/free_fire_app_icon_512.png';
        }}
      />

      {/* Cyan Crossed Swords combat indicator - strictly inside the logo, bottom-right */}
      <div
        className={cx(
          'absolute bottom-0.5 right-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-sm',
          isDark ? 'ring-1 ring-[#081326]' : 'ring-1 ring-white'
        )}
      >
        <svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 16l4 4" />
          <path d="M19 21l2-2" />
          <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
          <path d="M11 19l-6-6" />
          <path d="M8 16l-4 4" />
          <path d="M5 21l-2-2" />
        </svg>
      </div>
    </div>
  );
}

export function BgmiBadge({ isDark }: { isDark: boolean }) {
  return (
    <div
      title="BGMI Match"
      className={cx(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 bg-[#081326]',
        isDark ? 'ring-1.5 ring-orange-400/80' : 'ring-1.5 ring-orange-600'
      )}
    >
      <img
        src="/assets/games/bgmi/icon.png"
        alt="BGMI"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// --- Official Indian Bank Logos (HDFC, SBI, ICICI, Axis, Kotak, PNB) ---

export function HdfcLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      {/* Official Real HDFC Bank Logo: 4 Red outer blocks, white cross channels, and center Blue square */}
      <rect x="0" y="0" width="14" height="14" rx="4" fill="#ED232A" />
      <rect x="18" y="0" width="14" height="14" rx="4" fill="#ED232A" />
      <rect x="0" y="18" width="14" height="14" rx="4" fill="#ED232A" />
      <rect x="18" y="18" width="14" height="14" rx="4" fill="#ED232A" />

      {/* Inner square alignment */}
      <rect x="5" y="5" width="9" height="9" fill="#ED232A" />
      <rect x="18" y="5" width="9" height="9" fill="#ED232A" />
      <rect x="5" y="18" width="9" height="9" fill="#ED232A" />
      <rect x="18" y="18" width="9" height="9" fill="#ED232A" />

      {/* Center HDFC Blue Box (#004C8F) */}
      <rect x="11" y="11" width="10" height="10" fill="#004C8F" />
    </svg>
  );
}

export function SbiLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none">
      <circle cx="18" cy="18" r="18" fill="#0072BB" />
      <circle cx="18" cy="13.5" r="5.8" fill="#FFFFFF" />
      <rect x="16.2" y="13.5" width="3.6" height="15.5" fill="#FFFFFF" />
    </svg>
  );
}

export function IciciLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none">
      <rect width="36" height="36" rx="7" fill="#B83727" />
      <circle cx="18" cy="18" r="13" fill="#EA5A24" />
      <circle cx="18" cy="11" r="2.8" fill="#FFFFFF" />
      <path
        d="M15.5 15.5h5v11h-5z M18 15.5c4 0 7 3.2 7 7.2s-3.2 7.2-7 7.2"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function AxisLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none">
      <rect width="36" height="36" rx="7" fill="#97144D" />
      <path d="M18 7.5l9 16.5h-5.2l-3.8-7.5-3.8 7.5H9l9-16.5z" fill="#FFFFFF" />
      <polygon points="18,18 21.2,24 14.8,24" fill="#97144D" />
    </svg>
  );
}

export function KotakLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none">
      <rect width="36" height="36" rx="7" fill="#ED1C24" />
      <path
        d="M11 18c0-3.3 2.7-6 6-6 2.5 0 4.6 1.5 5.5 3.7l-2.6 1.5c-.6-1.3-1.7-2.2-2.9-2.2-1.7 0-3 1.3-3 3s1.3 3 3 3c1.2 0 2.3-.9 2.9-2.2l2.6 1.5c-.9 2.2-3 3.7-5.5 3.7-3.3 0-6-2.7-6-6z"
        fill="#FFFFFF"
      />
      <circle cx="24" cy="18" r="3" fill="#FFFFFF" />
    </svg>
  );
}

export function PnbLogo({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none">
      <rect width="36" height="36" rx="7" fill="#A31C24" />
      <circle cx="18" cy="18" r="10.5" stroke="#FDB913" strokeWidth="2.8" fill="none" />
      <circle cx="18" cy="18" r="4.2" fill="#FDB913" />
      <rect x="16.5" y="11" width="3" height="14" fill="#A31C24" />
    </svg>
  );
}

// --- Official Card Network Logos (Visa, Mastercard, RuPay) ---

export function VisaLogo({ className = 'h-5 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 16" className={className} fill="none">
      <path d="M19.5 1h-3.8c-.8 0-1.5.5-1.8 1.2L8.2 15h4.1l.8-2.3h5.1l.5 2.3h3.7L19.5 1zm-5.2 8.9l2.1-5.8 1.2 5.8h-3.3zM8.5 1L4.6 11.2 4.2 9C3.5 6.3 1.2 3.3 0 2.2l3.4 12.8h4.2L14 1H8.5zM38.5 10.8c.1-3.6-5-3.8-5-5.4 0-1.6 1.6-1.9 2.7-1.9 1.5 0 3 .3 4.2 1l.6-3C39.8 1.1 38.2.8 36.3.8c-4.2 0-7.2 2.2-7.2 5.5 0 4.2 5.8 4.4 5.8 6.7 0 1.8-2.1 2.1-3.3 2.1-2 0-3.8-.5-5.2-1.3l-.7 3.3c1.7.8 3.8 1.2 6 1.2 4.4 0 7.8-2.2 7.8-7.5zM48 15h-3.4l2.1-14H50l-2 14z" fill="#1A1F71" />
      <path d="M7.6 1H0l.1.5C6 2.8 10.3 7 11.8 11.2L10.3 3C10 1.8 9 1 7.6 1z" fill="#F7B600" />
    </svg>
  );
}

export function MastercardLogo({ className = 'h-5 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={className} fill="none">
      <circle cx="13" cy="12" r="10" fill="#EB001B" />
      <circle cx="23" cy="12" r="10" fill="#F79E1B" fillOpacity="0.88" />
    </svg>
  );
}

export function RupayLogo({ className = 'h-5 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 18" className={className} fill="none">
      <path d="M3.5 3h5.2c2.4 0 4.1 1.2 4.1 3.4 0 2.1-1.6 3.3-3.8 3.4l4.5 5.2h-3.3l-4.1-4.8H6.2v4.8H3.5V3zm2.7 4.7h2.3c1 0 1.7-.5 1.7-1.3 0-.8-.7-1.3-1.7-1.3H6.2v2.6z" fill="#002E6E" />
      <path d="M19 8.2h2.7v5.8c0 1.4-.8 2.2-2.3 2.2s-2.3-.8-2.3-2.2V8.2h2.7v5.6c0 .4.2.6.6.6s.6-.2.6-.6V8.2z" fill="#002E6E" />
      <path d="M25.5 3h4.6c2.5 0 4.2 1.4 4.2 3.7 0 2.3-1.7 3.7-4.2 3.7h-1.9v4.6h-2.7V3zm2.7 5.2h1.8c1 0 1.7-.5 1.7-1.5 0-1-.7-1.5-1.7-1.5h-1.8v3z" fill="#097939" />
      <path d="M37 9.8c0-1.2.9-2 2.3-2s2.3.8 2.3 2v5.2H39v-1.1c-.5.8-1.4 1.3-2.4 1.3-1.5 0-2.6-1-2.6-2.4 0-1.6 1.3-2.3 3.3-2.3h1.3v-.6c0-.4-.3-.6-.8-.6s-.8.2-.8.6H37zm4.6 2.7h-1.2c-1 0-1.5.3-1.5 1 0 .6.4 1 1.1 1 .8 0 1.6-.5 1.6-1.3v-.7z" fill="#097939" />
      <path d="M43 8.2h2.9l1.8 4.8 1.7-4.8h2.9l-3.3 7.8c-.8 1.8-1.8 2.4-3.3 2.4h-1v-2.1h.6c.6 0 1-.2 1.3-.9l.2-.5-3.8-6.7z" fill="#097939" />
      <polygon points="51,3 54,3 52,15 49,15" fill="#ED7524" />
    </svg>
  );
}

