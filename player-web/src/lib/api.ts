/**
 * Thin typed client for the Thunder eSports backend (Express + Prisma).
 *
 * Filled in page by page while we port the demo screens to real data:
 *   ✅ auth (login / OTP / session)
 *   ⏳ tournaments feed, join, wallet, transactions
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api/v1';

/** Tenant that every request is scoped to (the org the app is white-labelled for). */
const TENANT_ID =
  (import.meta.env.VITE_TENANT_ID as string | undefined) ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';

/** Allows the local `dev_otp_<phone>` shortcut (server must run DEV_FAKE_FIREBASE=true). */
export const DEV_AUTH = (import.meta.env.VITE_DEV_AUTH as string | undefined) !== 'false';

const TOKEN_KEY = 'thunder.auth.token';
const USER_KEY = 'thunder.auth.user';

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode?: number;
}

export interface ApiUser {
  id: string;
  phoneNumber: string | null;
  email?: string | null;
  name: string | null;
  inGameName?: string | null;
  inGameUid?: string | null;
  role: 'USER' | 'ADMIN' | 'SUB_ADMIN';
  depositBalance?: string | number;
  winningBalance?: string | number;
}

export interface AuthSession {
  token: string;
  user: ApiUser;
}

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      payload?.statusCode ?? response.status,
      payload?.data
    );
  }

  return (payload?.data ?? payload) as T;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession): AuthSession {
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch {
    /* private mode — the session simply will not survive a reload */
  }
  return session;
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/** 10-digit Indian number → `dev_otp_<number>`; the server turns it into a real JWT. */
export function devIdToken(phone: string): string {
  return `dev_otp_${phone.replace(/\D/g, '').slice(-10)}`;
}

export const auth = {
  /** Phone + Firebase ID token (web). Returns the JWT the rest of the app uses. */
  loginWithToken: (phone: string, idToken: string) =>
    request<AuthSession>('/auth/player/login', {
      method: 'POST',
      body: JSON.stringify({ tenantId: TENANT_ID, phoneNumber: phone, idToken }),
    }).then(saveSession),

  /** New number: OTP verified but no account yet. */
  registerWithToken: (phone: string, idToken: string, name?: string) =>
    request<AuthSession>('/auth/player/register', {
      method: 'POST',
      body: JSON.stringify({ tenantId: TENANT_ID, phoneNumber: phone, idToken, name }),
    }).then(saveSession),

  /** Google (web) — the Firebase Google credential's ID token. */
  loginWithGoogle: (idToken: string, name?: string) =>
    request<AuthSession>('/auth/player/google', {
      method: 'POST',
      body: JSON.stringify({ tenantId: TENANT_ID, idToken, name }),
    }).then(saveSession),

  /** Local demo: skip Firebase SMS entirely (server needs DEV_FAKE_FIREBASE=true). */
  async loginDev(phone: string): Promise<AuthSession> {
    const idToken = devIdToken(phone);
    try {
      return await auth.loginWithToken(phone, idToken);
    } catch (error) {
      if (error instanceof ApiError && /not registered|register first/i.test(error.message)) {
        return auth.registerWithToken(phone, idToken);
      }
      throw error;
    }
  },

  me: () => request<ApiUser>('/auth/me'),

  logout: clearSession,
};

// ── Tournaments ──────────────────────────────────────────────────────────

export interface ApiTournament {
  id: string;
  title: string;
  matchNumber: number | null;
  gameMode: 'BATTLE_ROYALE' | 'CLASH_SQUAD';
  matchType: 'SOLO' | 'DUO' | 'SQUAD';
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  entryFee: string;
  prizePool: string;
  perKillPrize: string | null;
  totalSlots: number;
  slotsBooked: number;
  matchTime: string;
  status: 'DRAFT' | 'UPCOMING' | 'OPEN' | 'SLOTS_FULL' | 'ROOM_REVEALED' | 'LIVE' | 'UNDER_REVIEW' | 'COMPLETED' | 'CANCELLED';
  mySlot: { slotNumber: number; teamId: string | null } | null;
  isListedNow?: boolean | null;
  roomUnlocked?: boolean | null;
  room?: { roomId: string | null; roomPassword: string | null } | null;
  hasRoomCredentials?: boolean | null;
}

export interface ApiPaged<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages?: number };
}

export interface ApiJoinResult {
  tournamentId: string;
  slotNumber: number;
  entryFee: string;
  depositBalance: string;
  winningBalance: string;
}

export interface ApiWallet {
  depositBalance: string;
  winningBalance: string;
  totalBalance: string;
  ledger: Array<{
    id: string;
    amount: string;
    balanceType: 'DEPOSIT' | 'WINNING';
    type: 'CREDIT' | 'DEBIT';
    category: string;
    balanceAfter: string;
    referenceId: string | null;
    notes: string | null;
    createdAt: string;
  }>;
}

export const tournaments = {
  /** Player feed: only matches that are actually open to join right now. */
  list: (status?: string) =>
    request<ApiPaged<ApiTournament>>(
      `/tournaments?limit=50${status ? `&status=${encodeURIComponent(status)}` : ''}`
    ),

  details: (id: string) => request<ApiTournament>(`/tournaments/${id}`),

  join: (
    id: string,
    payload: { slotNumber?: number; inGameName?: string; inGameUid?: string; saveAsDefault?: boolean }
  ) =>
    request<ApiJoinResult>(`/tournaments/${id}/join`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface ApiPaymentOrder {
  orderId: string;
  provider: 'razorpay' | 'mock';
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
}

export interface ApiOrderStatus {
  id: string;
  status: 'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED' | 'EXPIRED';
  amountPaise: number;
  providerPaymentId: string | null;
  capturedAt: string | null;
}

export const payments = {
  /** Creates a gateway order; mock provider also returns a checkout page URL. */
  createOrder: (amountRupees: number) =>
    request<ApiPaymentOrder>('/payments/orders', {
      method: 'POST',
      body: JSON.stringify({ amountPaise: Math.round(amountRupees * 100) }),
    }),

  status: (orderId: string) => request<ApiOrderStatus>(`/payments/orders/${orderId}`),

  /** Mock provider only: simulate the player paying (or failing) in checkout. */
  demoPay: (providerOrderId: string, outcome: 'success' | 'failure' = 'success') =>
    request<{ orderId: string; status: string }>('/payments/demo/pay', {
      method: 'POST',
      body: JSON.stringify({ orderId: providerOrderId, outcome }),
    }),

  my: () => request<ApiPaged<Record<string, unknown>>>('/payments/my'),
};

export const wallet = {
  summary: (page = 1, limit = 25) => request<ApiWallet>(`/wallet?page=${page}&limit=${limit}`),

  withdraw: (amountRupees: number, upiId: string) =>
    request<{ withdrawalId: string; amount: string; status: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: amountRupees, upiId }),
    }),
};

export const api = {
  auth,
  tournaments,
  wallet,
  payments,
  tenantId: TENANT_ID,
  baseUrl: API_BASE,
};
