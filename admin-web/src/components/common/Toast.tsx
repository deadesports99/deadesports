import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { cx } from '../../lib/format';
import type { ToastMessage } from '../../types';

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Toasts — one at a time, auto-dismiss in 3.5s, never block a click.
 * Same visual language as the player app's pill toast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((type: ToastMessage['type'], text: string) => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    setToast({ id: Date.now(), type, text });
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (text: string) => show('success', text),
      error: (text: string) => show('error', text),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && <ToastView toast={toast} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

function ToastView({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const isDark = useTheme() === 'dark';
  const isError = toast.type === 'error';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-4 sm:top-5">
      <button
        type="button"
        onClick={onClose}
        role="status"
        aria-live="polite"
        className={cx(
          'pointer-events-auto flex max-w-[440px] items-start gap-2 rounded-2xl border px-4 py-2.5 text-left text-xs font-bold shadow-xl backdrop-blur-md animate-fade-up',
          isError
            ? isDark
              ? 'border-rose-400/40 bg-rose-950/95 text-rose-100'
              : 'border-rose-200 bg-white text-rose-700'
            : isDark
              ? 'border-emerald-400/35 bg-[#07130f]/95 text-emerald-200'
              : 'border-emerald-200 bg-white text-emerald-700'
        )}
      >
        <span
          className={cx(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
            isError ? 'bg-rose-400/20' : 'bg-emerald-400/20'
          )}
        >
          {isError ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
        </span>
        <span className="leading-snug">{toast.text}</span>
      </button>
    </div>
  );
}
