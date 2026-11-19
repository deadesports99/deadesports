import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { ApiError, StepUpRequiredError, api } from '../lib/api';
import { FormDialog } from '../components/common/FormDialog';
import { AppButton } from '../components/common/AppButton';
import { Field, InlineError, TextInput } from '../screens/matches/MatchFormBits';
import { useToast } from '../components/common/Toast';

/**
 * ─── Step-up confirmation ────────────────────────────────────────────────
 *
 * Money and settings actions need a fresh 6-digit code even on a valid session,
 * so a stolen cookie can read but not spend. `run()` wraps the call:
 *
 *   await stepUp.run('approving a withdrawal', () => api.wallet.approveWithdrawal(id, utr));
 *
 * 1. action() runs with whatever short-lived proof we already hold
 * 2. the server answers 403 STEP_UP_REQUIRED
 * 3. we mail a code to the admin's own inbox, collect it, exchange it for a proof
 * 4. action() is retried once — the proof header is attached automatically
 */

interface PendingGate {
  action: string;
  resolve: (confirmed: boolean) => void;
}

interface StepUpApi {
  /** Runs a sensitive action, prompting for a code only when the server asks. */
  run: <T>(action: string, call: () => Promise<T>) => Promise<T>;
}

const StepUpContext = createContext<StepUpApi | null>(null);

export function StepUpProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [gate, setGate] = useState<PendingGate | null>(null);

  const run = useCallback<StepUpApi['run']>(async (action, call) => {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof StepUpRequiredError)) throw error;

      // Ask for a code; the dialog resolves true once the proof is stored.
      const confirmed = await new Promise<boolean>((resolve) => {
        setGate({ action, resolve });
      });
      if (!confirmed) throw error;

      toast.success('Confirmed — retrying');
      return await call();
    }
  }, [toast]);

  const close = useCallback(
    (confirmed: boolean) => {
      gate?.resolve(confirmed);
      setGate(null);
    },
    [gate]
  );

  const value = useMemo<StepUpApi>(() => ({ run }), [run]);

  return (
    <StepUpContext.Provider value={value}>
      {children}
      <StepUpDialog gate={gate} onClose={close} />
    </StepUpContext.Provider>
  );
}

export function useStepUp(): StepUpApi {
  const context = useContext(StepUpContext);
  if (!context) throw new Error('useStepUp must be used inside <StepUpProvider>');
  return context;
}

/** The modal: mails a code on open, then verifies it into a proof token. */
function StepUpDialog({ gate, onClose }: { gate: PendingGate | null; onClose: (ok: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const requestedFor = useRef<string | null>(null);

  const send = useCallback(async () => {
    setSending(true);
    setError('');
    setDebugOtp(null);
    try {
      const result = await api.stepUp.request();
      setEmail(result.email);
      setDebugOtp(result.debugOtp ?? null);
      requestedFor.current = result.email;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the confirmation code');
    } finally {
      setSending(false);
    }
  }, []);

  // Mail a code as soon as the gate opens (no extra click for the admin).
  useEffect(() => {
    if (!gate) {
      requestedFor.current = null;
      setCode('');
      setEmail('');
      setError('');
      setDebugOtp(null);
      return;
    }
    if (requestedFor.current) return;
    requestedFor.current = 'pending';
    void send();
  }, [gate, send]);

  const verify = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await api.stepUp.verify(email, code.trim());
      onClose(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof StepUpRequiredError
            ? err.message
            : 'That code did not work'
      );
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying;

  return (
    <FormDialog
      open={Boolean(gate)}
      busy={busy}
      title="Confirm it's really you"
      description={
        gate
          ? `Enter the 6-digit code we mailed you to continue with ${gate.action}. A stolen session alone can never do this.`
          : undefined
      }
      onClose={() => onClose(false)}
      footer={
        <>
          <AppButton variant="ghost" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </AppButton>
          <AppButton
            icon={<ShieldCheck className="h-4 w-4" />}
            loading={verifying}
            disabled={busy || code.trim().length !== 6}
            onClick={() => void verify()}
          >
            Confirm
          </AppButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-900 dark:text-amber-200">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Code sent to <b>{email || 'your admin inbox'}</b>
            {sending ? ' …' : ''}. It expires in 10 minutes.
          </span>
        </div>

        <Field label="6-digit code">
          <TextInput
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
        </Field>

        {debugOtp && (
          <p className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            Dev code: <span className="font-mono">{debugOtp}</span>
          </p>
        )}

        {error && <InlineError>{error}</InlineError>}

        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="text-[12.5px] font-bold text-slate-600 underline disabled:opacity-50 dark:text-slate-300"
        >
          Resend code
        </button>
      </div>
    </FormDialog>
  );
}
