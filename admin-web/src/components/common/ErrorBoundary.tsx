import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

/**
 * Last-resort guard so a render crash shows a reload action instead of a blank
 * tab (this console is often left running on a match-night laptop).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console log only — never include session data or OTPs.
    console.error('Admin console crashed:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050B14] px-6 text-center text-white">
          <div className="max-w-sm">
            <p className="text-sm font-black">Something went wrong</p>
            <p className="mt-1 text-xs text-slate-400">
              The console hit an unexpected error. Reload to continue — your session cookie is safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 h-10 rounded-xl bg-[#FFD000] px-4 text-xs font-black text-slate-950"
            >
              Reload console
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
