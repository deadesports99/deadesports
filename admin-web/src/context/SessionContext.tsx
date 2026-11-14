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
import { UNAUTHORIZED_EVENT, api } from '../lib/api';
import type { AdminUser } from '../types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface SessionApi {
  user: AdminUser | null;
  status: Status;
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
 * are signed in is `GET /auth/me`. A 401 anywhere in the app fires
 * `admin:unauthorized`, which drops the console back to the login screen.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');
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
      }
      return me;
    } catch {
      if (mounted.current) {
        setUser(null);
        setStatus('anonymous');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    () => ({ user, status, refresh, signIn, signOut }),
    [user, status, refresh, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}
