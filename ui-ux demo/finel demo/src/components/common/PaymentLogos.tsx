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

export function PaytmLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <div className={cx('flex items-baseline font-black leading-none tracking-tighter', className)}>
      <span className="text-[10px] text-[#002E6E] font-black">Pay</span>
      <span className="text-[10px] text-[#00BAF2] font-black">tm</span>
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

        {/* 3. Paytm (White Circle with official dark blue 'Pay' & light cyan 'tm') */}
        <div
          title="Paytm UPI"
          className={cx(
            'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110 hover:z-10 bg-white',
            ringBorder
          )}
        >
          <div className="flex items-baseline font-black leading-none tracking-tighter">
            <span className="text-[7px] text-[#002E6E] font-extrabold">Pay</span>
            <span className="text-[7px] text-[#00BAF2] font-black">tm</span>
          </div>
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
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm',
        isDark ? 'ring-1 ring-white/20' : 'ring-1 ring-slate-900/15'
      )}
    >
      <div className="flex items-baseline font-black leading-none tracking-tighter">
        <span className="text-[9px] text-[#002E6E] font-black">Pay</span>
        <span className="text-[9px] text-[#00BAF2] font-black">tm</span>
      </div>
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
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 bg-[#081326]',
        isDark
          ? 'ring-1.5 ring-amber-400/90 shadow-amber-500/20 shadow-md'
          : 'ring-1.5 ring-amber-500 shadow-amber-500/30 shadow-md'
      )}
    >
      <img
        src="/assets/games/freefire/icon.png"
        alt="Free Fire"
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/logos/free_fire_app_icon_512.png';
        }}
      />
      {/* Golden Crown mini indicator at bottom right */}
      <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 ring-1 ring-slate-950 shadow-xs">
        <svg viewBox="0 0 24 24" className="h-2 w-2" fill="currentColor">
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
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform hover:scale-105 bg-[#081326]',
        isDark
          ? 'ring-1.5 ring-cyan-400/80 shadow-cyan-500/20 shadow-md'
          : 'ring-1.5 ring-cyan-600 shadow-cyan-600/20 shadow-md'
      )}
    >
      <img
        src="/assets/games/freefire/icon.png"
        alt="Free Fire"
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/logos/free_fire_app_icon_512.png';
        }}
      />
      {/* Cyan Swords mini indicator at bottom right */}
      <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-400 text-slate-950 ring-1 ring-slate-950 shadow-xs">
        <svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
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

