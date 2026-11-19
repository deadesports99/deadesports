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
import { ApiError, UNAUTHORIZED_EVENT, api } from '../lib/api';
import type { AdminUser } from '../types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface SessionApi {
  user: AdminUser | null;
  status: Status;
  /** True while the backend is unreachable but the cookie may still be valid. */
  reconnecting: boolean;
  /** Fetch `/auth/me` again (permissions are live on the DB row). */
  refresh: () => Promise<AdminUser | null>;
  /** Called right after the OTP cookie is issued. */
  signIn: () => Promise<AdminUser | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Session bootstrap + cookie expiry handling.
 *
 * The httpOnly cookie is invisible to JS, so the only way to know whether we
 * are signed in is `GET /auth/me`.
 *
 * Rule: ONLY a 401 means "signed out". A network blip, a backend restart or a
 * 5xx used to drop the console to the login screen even though the cookie was
 * perfectly valid — that is what made admins feel logged out all the time. Now
 * those failures keep the current session and retry quietly.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [reconnecting, setReconnecting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<AdminUser | null> => {
    try {
      const me = await api.auth.me();
      if (mounted.current) {
        setUser(me);
        setStatus('authenticated');
        setReconnecting(false);
      }
      return me;
    } catch (error) {
      const statusCode = error instanceof ApiError ? error.statusCode : 0;

      // Server/network trouble is NOT a logout — keep the session and retry.
      if (statusCode !== 401) {
        if (mounted.current) setReconnecting(true);
        return null;
      }

      if (mounted.current) {
        setUser(null);
        setStatus('anonymous');
        setReconnecting(false);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Retry while the backend is unreachable instead of showing the login form.
  useEffect(() => {
    if (!reconnecting) return undefined;
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [reconnecting, refresh]);

  const signIn = useCallback(async () => {
    const me = await api.auth.me();
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      /* the cookie may already be gone — either way we drop local state */
    }
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const value = useMemo<SessionApi>(
    () => ({ user, status, reconnecting, refresh, signIn, signOut }),
    [user, status, reconnecting, refresh, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
