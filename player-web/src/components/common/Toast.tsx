import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cx } from '../../utils/formatters';

interface ToastProps {
  toast: {
    type: 'success' | 'error';
    text: string;
  };
}

export function Toast({ toast }: ToastProps) {
  return (
    <div className="fixed inset-x-0 top-14 z-[90] flex justify-center px-4 pointer-events-none">
      <div
        className={cx(
          'flex max-w-[390px] items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-bold shadow-lg backdrop-blur-md',
          toast.type === 'error'
            ? 'border-rose-400/40 bg-rose-950/95 text-rose-200'
            : 'border-emerald-400/35 bg-slate-950/95 text-emerald-300'
        )}
      >
        <span
          className={cx(
            'flex h-4 w-4 items-center justify-center rounded-full',
            toast.type === 'error' ? 'bg-rose-400/20' : 'bg-emerald-400/20'
          )}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="h-3 w-3 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          )}
        </span>
        <span>{toast.text}</span>
      </div>
    </div>
  );
}
