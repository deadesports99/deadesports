import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import { AppButton } from './AppButton';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/**
 * Destructive-action guard (cancel & refund, revoke key, ban…).
 * Escape closes, backdrop click closes, confirm is never the default focus trap.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
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
    <div className="fixed inset-0 z-[110] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className={cx(
          'relative w-full max-w-md rounded-2xl border p-5 shadow-2xl animate-fade-up',
          isDark ? 'border-white/10 bg-[#0C121E]' : 'border-slate-200 bg-white'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            id="confirm-title"
            className={cx('text-sm font-black tracking-tight', isDark ? 'text-white' : 'text-slate-950')}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isDark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {description && (
          <p className={cx('mt-2 text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {description}
          </p>
        )}

        {children && <div className="mt-4 space-y-3">{children}</div>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AppButton variant="secondary" onClick={onClose} disabled={busy} fullWidth>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={busy}
            fullWidth
          >
            {confirmLabel}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
