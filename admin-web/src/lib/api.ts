import type {
  AdminAccessKey,
  AdminDeposit,
  AdminPaymentsResult,
  AdminPlayersResult,
  AdminTournament,
  AdminUser,
  AdminWithdrawal,
  CancelMatchResult,
  DailySettlement,
  DeviceGroup,
  DeviceGroupDetail,
  IssuedAccessKey,
  PlayerDetail,
  SuspiciousPlayer,
  TenantSettings,
  WatchlistSummary,
  MatchRoomCredentials,
  MatchRoster,
  Paged,
  PayoutAwardInput,
  PayoutAwardsResult,
  RoomPublishResult,
  RoomRevealResult,
  SweepResult,
} from '../types';

/**
 * Thin typed client for the admin console.
 *
 * The session lives in an **httpOnly cookie** (`admin_session`), so there is no
 * token in JS and every call just needs `credentials: 'include'`. Requests go to
 * the same origin (`/api/v1`, proxied in dev) which keeps the cookie host-only
 * and the backend's CSRF Origin gate happy.
 */

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1').replace(
  /\/+$/,
  ''
);

/** Tenant the console operates on (white-label org id). */
export const TENANT_ID =
  (import.meta.env.VITE_TENANT_ID as string | undefined) ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';

/** Fired when the cookie session dies; App drops to the login screen. */
export const UNAUTHORIZED_EVENT = 'admin:unauthorized';

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

interface RequestOptions extends RequestInit {
  /** Skip the global 401 → login redirect (used by the login screen itself). */
  skipAuthRedirect?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect, ...init } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Network error — check your connection and try again', 0);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401 && !skipAuthRedirect) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
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

// ── Auth ────────────────────────────────────────────────────────────────

export interface AdminOtpRequestResult {
  expiresInSeconds: number;
  requiresKey: boolean;
  /** Dev only (backend returns it when NODE_ENV !== 'production'). */
  debugOtp?: string;
}

export interface AdminOtpVerifyResult {
  user: AdminUser;
}

export const auth = {
  /** Step 1 — owner email, or owner email + a staff permission key. */
  requestOtp: (payload: { email: string; accessKey?: string }) =>
    request<AdminOtpRequestResult>('/auth/admin/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email: payload.email, accessKey: payload.accessKey, tenantId: TENANT_ID }),
      skipAuthRedirect: true,
    }),

  /** Step 2 — 6-digit code → httpOnly cookie is set by the server. */
  verifyOtp: (payload: { email: string; otp: string; accessKey?: string }) =>
    request<AdminOtpVerifyResult>('/auth/admin/otp/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRedirect: true,
    }),

  /** Session bootstrap — works from the cookie (no Bearer token). */
  me: () => request<AdminUser>('/auth/me', { skipAuthRedirect: true }),

  logout: () => request<undefined>('/auth/admin/logout', { method: 'POST', skipAuthRedirect: true }),
};

// ── Matches ─────────────────────────────────────────────────────────────

export interface CreateMatchInput {
  gameMode: 'BATTLE_ROYALE' | 'CLASH_SQUAD';
  matchType: 'SOLO' | 'DUO' | 'SQUAD';
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  entryFee: number;
  prizePool: number;
  perKillPrize?: number;
  matchTime: string;
  totalSlots?: number;
  /** null/omitted = list immediately; N = hide from players until N hours before start. */
  visibilityHours?: number | null;
}

export interface MatchListOptions {
  status?: string;
  publishable?: boolean;
  page?: number;
  limit?: number;
}

function matchListQuery(options: MatchListOptions): string {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 50),
    page: String(options.page ?? 1),
  });
  if (options.status) params.set('status', options.status);
  if (options.publishable) params.set('publishable', 'true');
  return params.toString();
}

export const matches = {
  /** Staff see every scheduled match (including hidden ones). */
  list: (options: MatchListOptions = {}) =>
    request<Paged<AdminTournament>>(`/tournaments?${matchListQuery(options)}`),

  /**
   * Every page of the tenant's match list, de-duplicated by id.
   * The tabs (LIVE / UPCOMING / HISTORY) filter client-side, so the console
   * needs the full picture — a 50-row page would hide older history.
   */
  listAll: async (options: Omit<MatchListOptions, 'page' | 'limit'> = {}) => {
    const seen = new Map<string, AdminTournament>();
    const maxPages = 20;

    for (let page = 1; page <= maxPages; page += 1) {
      const result = await matches.list({ ...options, page, limit: 50 });
      const items = result.items ?? [];
      for (const item of items) seen.set(item.id, item);

      const totalPages = result.pagination?.totalPages ?? 1;
      if (page >= totalPages || items.length === 0) break;
    }

    return [...seen.values()];
  },

  detail: (id: string) => request<AdminTournament>(`/tournaments/${id}`),

  /** canCreateMatch — no title field: the backend auto-generates it. */
  create: (input: CreateMatchInput) =>
    request<AdminTournament>('/tournaments', { method: 'POST', body: JSON.stringify(input) }),

  /** canCreateMatch — null = listed immediately, N = last N hours only. */
  visibility: (id: string, visibilityHours: number | null) =>
    request<AdminTournament>(`/tournaments/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibilityHours }),
    }),

  /** canCreateMatch — one-tap re-run with a fresh date (settings inherited). */
  clone: (id: string, matchTime: string) =>
    request<AdminTournament>(`/tournaments/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ matchTime }),
    }),

  /** canCreateMatch — cancel + refund every seated player. */
  cancel: (id: string, reason: string) =>
    request<CancelMatchResult>(`/tournaments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** canCreateMatch — manual lifecycle sweep (T-0 -> LIVE, stale LIVE -> review). */
  sweep: () => request<SweepResult>('/tournaments/sweep/states', { method: 'POST' }),

  /** canUpdateRoomId — publishing IS the reveal (no clock in the backend). */
  publishRoom: (id: string, roomId: string, roomPassword: string) =>
    request<RoomPublishResult>(`/tournaments/${id}/room`, {
      method: 'PATCH',
      body: JSON.stringify({ roomId, roomPassword }),
    }),

  /** canUpdateRoomId — reveal already-published credentials now. */
  roomReveal: (id: string) =>
    request<RoomRevealResult>(`/tournaments/${id}/room-reveal`, {
      method: 'PATCH',
      body: JSON.stringify({ revealNow: true }),
    }),

  /** Revealed credentials only — the backend 403s before the reveal window. */
  room: (id: string) => request<MatchRoomCredentials>(`/tournaments/${id}/room`),

  // ── Roster / payout (canDistributePrize) ────────────────────────────

  roster: (id: string) => request<MatchRoster>(`/admin/matches/${id}/participants`),

  payout: (id: string, awards: PayoutAwardInput[], completeMatch: boolean) =>
    request<PayoutAwardsResult>(`/admin/matches/${id}/payout`, {
      method: 'POST',
      body: JSON.stringify({ awards, completeMatch }),
    }),

  banParticipant: (
    id: string,
    userId: string,
    payload: { isBanned: boolean; reason?: string; banAccount?: boolean }
  ) =>
    request<{ tournamentId: string; userId: string; matchBanned: boolean; accountBanned: boolean; banReason: string | null }>(
      `/admin/matches/${id}/participants/${userId}/ban`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  /** CSV download through the cookie session (a plain <a href> has no cookies). */
  downloadRosterCsv: async (id: string, filename?: string) => {
    const response = await fetch(`${API_BASE}/admin/matches/${id}/participants/export.csv`, {
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });

    if (response.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    if (!response.ok) {
      let message = `Could not export CSV (${response.status})`;
      try {
        const payload: any = await response.json();
        message = payload?.message ?? message;
      } catch {
        /* CSV endpoint may fail with an empty body */
      }
      throw new ApiError(message, response.status);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename ?? 'match-roster.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};

// ── Wallet console (canManageWallet) ────────────────────────────────────

export const wallet = {
  withdrawals: (status?: 'PENDING' | 'APPROVED' | 'REJECTED') =>
    request<{ withdrawals: AdminWithdrawal[]; count: number }>(
      `/admin/wallet/withdrawals${status ? `?status=${status}` : ''}`
    ),

  approveWithdrawal: (id: string, utrNumber: string) =>
    request<{ message: string }>(`/admin/wallet/withdrawals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ utrNumber }),
    }),

  rejectWithdrawal: (id: string, reason: string) =>
    request<{ message: string }>(`/admin/wallet/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  deposits: (status?: 'PENDING' | 'APPROVED' | 'REJECTED') =>
    request<{ deposits: AdminDeposit[]; count: number; pendingTotal: number }>(
      `/admin/wallet/deposits${status ? `?status=${status}` : ''}`
    ),

  approveDeposit: (id: string) =>
    request<{ message: string }>(`/admin/wallet/deposits/${id}/approve`, { method: 'POST' }),

  rejectDeposit: (id: string, reason: string) =>
    request<{ message: string }>(`/admin/wallet/deposits/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  payments: (options: { status?: string; page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams({
      status: options.status ?? 'ALL',
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 20),
    });
    return request<AdminPaymentsResult>(`/admin/wallet/payments?${params.toString()}`);
  },

  syncPayment: (id: string) =>
    request<{ status: string; alreadySettled: boolean }>(`/admin/wallet/payments/${id}/sync`, {
      method: 'POST',
    }),

  /** Owner-only daily P&L (the route is ADMIN even for wallet staff). */
  settlement: (date: string) =>
    request<DailySettlement>(`/admin/wallet/settlement?date=${encodeURIComponent(date)}`),

  settlementCsv: (date: string, filename?: string) =>
    downloadFile(`/admin/wallet/settlement/export.csv?date=${encodeURIComponent(date)}`, filename ?? `settlement-${date}.csv`),
};

// ── Players / anti-cheat (owner only) ───────────────────────────────────

export const players = {
  list: (search?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    return request<AdminPlayersResult>(`/admin/players?${params.toString()}`);
  },

  detail: (id: string) => request<PlayerDetail>(`/admin/players/${id}`),

  setBanned: (id: string, isBanned: boolean) =>
    request<{ id: string; playerCode: string | null; isBanned: boolean }>(`/admin/players/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned }),
    }),

  suspicious: (minScore = 30, limit = 20) =>
    request<{ rows: SuspiciousPlayer[]; scannedUsers: number; minScore: number }>(
      `/admin/players/suspicious?minScore=${minScore}&limit=${limit}`
    ),

  devices: (minAccounts = 2, limit = 30) =>
    request<{ groups: DeviceGroup[]; totalDevices: number; minAccounts: number }>(
      `/admin/players/devices?minAccounts=${minAccounts}&limit=${limit}`
    ),

  device: (deviceId: string) =>
    request<DeviceGroupDetail>(`/admin/players/devices/${encodeURIComponent(deviceId)}`),

  banDevice: (deviceId: string, isBanned: boolean) =>
    request<{ updated: number }>(`/admin/players/devices/${encodeURIComponent(deviceId)}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned }),
    }),

  deviceCsv: (deviceId: string) =>
    downloadFile(
      `/admin/players/devices/${encodeURIComponent(deviceId)}/export.csv`,
      `device-${deviceId.slice(0, 12)}.csv`
    ),

  watchlist: () => request<WatchlistSummary>('/admin/players/watchlist'),

  watch: (deviceId: string, note?: string) =>
    request<{ watched: boolean }>('/admin/players/watchlist', {
      method: 'POST',
      body: JSON.stringify({ deviceId, note }),
    }),

  unwatch: (deviceId: string) =>
    request<{ watched: boolean }>(`/admin/players/watchlist/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    }),

  ackAlerts: (deviceId: string) =>
    request<{ acknowledged: number }>(`/admin/players/watchlist/${encodeURIComponent(deviceId)}/ack`, {
      method: 'PATCH',
    }),
};

// ── Staff access keys (owner only) ──────────────────────────────────────

export interface IssueAccessInput {
  name: string;
  email: string;
  phoneNumber: string;
  permissions: {
    canCreateMatch?: boolean;
    canUpdateRoomId?: boolean;
    canDistributePrize?: boolean;
    canManageWallet?: boolean;
  };
}

export const accessKeys = {
  list: () => request<{ keys: AdminAccessKey[]; count: number }>('/admin/access'),

  issue: (input: IssueAccessInput) =>
    request<IssuedAccessKey>('/admin/access', { method: 'POST', body: JSON.stringify(input) }),

  revoke: (id: string) => request<null>(`/admin/access/${id}/revoke`, { method: 'POST' }),

  regenerate: (id: string) =>
    request<IssuedAccessKey>(`/admin/access/${id}/regenerate`, { method: 'POST' }),
};

// ── Runtime tenant settings (owner only) ────────────────────────────────

export const settings = {
  get: () => request<TenantSettings>('/admin/tenant/settings'),

  update: (input: Partial<TenantSettings>) =>
    request<TenantSettings>('/admin/tenant/settings', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};

/** Cookie-authenticated file download (a plain <a href> would send no cookie). */
async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });

  if (response.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  if (!response.ok) {
    let message = `Could not download the file (${response.status})`;
    try {
      const payload: any = await response.json();
      message = payload?.message ?? message;
    } catch {
      /* file endpoints may fail with an empty body */
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export const api = {
  auth,
  matches,
  wallet,
  players,
  accessKeys,
  settings,
  tenantId: TENANT_ID,
  baseUrl: API_BASE,
};

/** Realtime gateway URL — `/ws?tenantId=…` at the API origin root. */
export function realtimeUrl(): string | null {
  const params = new URLSearchParams({ tenantId: TENANT_ID });
  if (typeof window === 'undefined') return null;

  // Dev proxy: same origin (:5174) with `/ws` proxied to Express.
  const base = API_BASE.startsWith('http') ? new URL(API_BASE) : new URL(window.location.origin);
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${base.host}/ws?${params.toString()}`;
}
