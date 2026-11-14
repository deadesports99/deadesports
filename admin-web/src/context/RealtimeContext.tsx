import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { connectRealtime, type RealtimeStatus } from '../lib/realtime';
import { useSession } from './SessionContext';

interface RealtimeApi {
  /** Increments (debounced) whenever the server pushes a tenant event. */
  version: number;
  status: RealtimeStatus;
  lastEventType: string | null;
  /** Manual refresh (top-bar button) — screens refetch immediately. */
  refresh: () => void;
}

const RealtimeContext = createContext<RealtimeApi>({
  version: 0,
  status: 'closed',
  lastEventType: null,
  refresh: () => undefined,
});

/**
 * One socket for the whole console. Screens listen to `version` and refetch —
 * they never trust the pushed payload, only the fact that something changed.
 *
 * 800ms debounce because a burst of SLOT_BOOKED events should cause one refetch.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession();
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<RealtimeStatus>('closed');
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return undefined;

    const bump = (type: string) => {
      setLastEventType(type);
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVersion((value) => value + 1), 800);
    };

    const disconnect = connectRealtime(
      (message) => {
        if (message.type === 'PONG' || message.type === 'CONNECTED') return;
        bump(message.type);
      },
      setStatus
    );

    return () => {
      disconnect();
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, [sessionStatus]);

  return (
    <RealtimeContext.Provider
      value={{
        version,
        status,
        lastEventType,
        refresh: () => setVersion((value) => value + 1),
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeApi {
  return useContext(RealtimeContext);
}
