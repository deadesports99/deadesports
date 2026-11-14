import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  className?: string;
}

/**
 * Generic modal used by the match dialogs (visibility, clone, cancel, ban).
 * Escape and backdrop close it unless a request is in flight. Sits above the
 * bottom nav so the action buttons never hide behind it on a phone.
 */
export function FormDialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  busy = false,
  className,
}: FormDialogProps) {
  const isDark = useTheme() === 'dark';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center px-3 pb-3 sm:items-center sm:px-4 sm:pb-0">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-dialog-title"
        className={cx(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border shadow-2xl animate-fade-up',
          'max-w-lg',
          isDark ? 'border-white/10 bg-[#0C121E]' : 'border-slate-200 bg-white',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgb(226 232 240)' }}>
          <div className="min-w-0">
            <h3
              id="form-dialog-title"
              className={cx('text-sm font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}
            >
              {title}
            </h3>
            {description && (
              <p className={cx('mt-1 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgb(226 232 240)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
