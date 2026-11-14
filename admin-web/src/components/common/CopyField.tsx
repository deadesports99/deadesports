import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import { useToast } from './Toast';

interface CopyFieldProps {
  value: string;
  label?: string;
  masked?: boolean;
  className?: string;
}

/**
 * Read-only value + copy button. Used for room credentials and the one-time
 * staff permission key (masked until revealed).
 */
export function CopyField({ value, label, masked = false, className }: CopyFieldProps) {
  const isDark = useTheme() === 'dark';
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  const shown = revealed ? value : '•'.repeat(Math.min(24, value.length));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label ?? 'Value'} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  return (
    <div className={className}>
      {label && (
        <p className={cx('mb-1 text-[10px] font-black uppercase tracking-wider', isDark ? 'text-slate-500' : 'text-slate-500')}>
          {label}
        </p>
      )}
      <div
        className={cx(
          'flex items-center gap-2 rounded-xl border px-3 py-2',
          isDark ? 'border-white/10 bg-[#060B14]' : 'border-slate-200 bg-slate-50'
        )}
      >
        <code
          className={cx(
            'min-w-0 flex-1 truncate font-mono text-[13px] font-bold tracking-wide',
            isDark ? 'text-white' : 'text-slate-950'
          )}
        >
          {shown}
        </code>

        {masked && (
          <button
            type="button"
            onClick={() => setRevealed((state) => !state)}
            className={cx('text-[11px] font-bold underline', isDark ? 'text-slate-400' : 'text-slate-600')}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}

        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label ?? 'value'}`}
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95',
            isDark
              ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:text-slate-950'
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
