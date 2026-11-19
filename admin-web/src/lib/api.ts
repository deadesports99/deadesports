import type {
  AdminAccessKey,
  AdminAuditRow,
  AdminDeposit,
  AdminPaymentsResult,
  AdminPlayersResult,
  AdminSessionInfo,
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
  ManageBoard,
  ManageMatchListResult,
  Paged,
  PayoutAwardInput,
  PayoutAwardsResult,
  PayoutFilterTab,
  PayoutInbox,
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

/**
 * The server refused a money/settings action until the admin re-confirms with a
 * fresh sign-in code (the step-up gate). The UI answers this with a modal, then
 * retries the exact same call — the proof token is attached automatically.
 */
export class StepUpRequiredError extends ApiError {
  action: string;

  constructor(message: string, action: string) {
    super(message, 403, { code: 'STEP_UP_REQUIRED', action });
    this.name = 'StepUpRequiredError';
    this.action = action;
  }
}

/**
 * Short-lived step-up proof, kept in memory only.
 *
 * Never persisted: it expires in ~10 minutes and a stolen localStorage copy
 * would be a second, quieter way to move money.
 */
let stepUpProof: { token: string; expiresAt: number } | null = null;

export function readStepUpProof(): string | null {
  if (!stepUpProof) return null;
  if (stepUpProof.expiresAt <= Date.now()) {
    stepUpProof = null;
    return null;
  }
  return stepUpProof.token;
}

export function storeStepUpProof(token: string, expiresInSeconds: number): void {
  // 30s safety margin so the proof never expires mid-request.
  stepUpProof = { token, expiresAt: Date.now() + Math.max(0, expiresInSeconds - 30) * 1000 };
}

export function clearStepUpProof(): void {
  stepUpProof = null;
}

interface RequestOptions extends RequestInit {
  /** Skip the global 401 → login redirect (used by the login screen itself). */
  skipAuthRedirect?: boolean;
  /** Sensitive action — attach the step-up proof and surface the step-up gate. */
  stepUp?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect, stepUp, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (stepUp) {
    const proof = readStepUpProof();
    if (proof) headers['X-Step-Up-Token'] = proof;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
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
    const details = payload?.data;
    if (details?.code === 'STEP_UP_REQUIRED') {
      clearStepUpProof();
      throw new StepUpRequiredError(
        payload?.message ?? 'Confirm this action with a sign-in code',
        String(details.action ?? 'this action')
      );
    }
    throw new ApiError(
      payload?.message ?? `Request failed (${response.status})`,
      payload?.statusCode ?? response.status,
      details
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

// ── Step-up confirmation (money / settings) ─────────────────────────────

/** The 6-digit code is mailed to the signed-in admin's own inbox. */
export const stepUp = {
  request: () =>
    request<{ email: string; expiresInSeconds: number; debugOtp?: string }>(
      '/auth/admin/step-up/request',
      { method: 'POST', body: '{}' }
    ),

  verify: async (email: string, otp: string) => {
    const result = await request<{ stepUpToken: string; expiresInSeconds: number }>(
      '/auth/admin/step-up/verify',
      { method: 'POST', body: JSON.stringify({ email, otp }) }
    );
    storeStepUpProof(result.stepUpToken, result.expiresInSeconds);
    return result;
  },
};

// ── Security: signed-in browsers + audit trail ───────────────────────────

export const security = {
  sessions: () =>
    request<{ sessions: AdminSessionInfo[]; count: number }>('/admin/security/sessions'),

  revokeSession: (id: string) =>
    request<undefined>(`/admin/security/sessions/${id}/revoke`, { method: 'POST' }),

  revokeOtherSessions: () =>
    request<{ revoked: number }>('/admin/security/sessions/revoke-others', { method: 'POST' }),

  /** Kills every session of this account, including this browser. */
  revokeAllSessions: () =>
    request<{ revoked: number }>('/admin/security/sessions/revoke-all', { method: 'POST' }),

  audit: (limit = 20) =>
    request<{ rows: AdminAuditRow[]; count: number }>(`/admin/security/audit?limit=${limit}`),
};

// ── Matches ─────────────────────────────────────────────────────────────

export interface CreateMatchInput {
  gameMode: 'BATTLE_ROYALE' | 'CLASH_SQUAD';
  matchType: 'SOLO' | 'DUO' | 'SQUAD';
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  entryFee: number;
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
      stepUp: true,
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
      stepUp: true,
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
    canManageMatch?: boolean;
    canUpdateRoomId?: boolean;
    canViewPayout?: boolean;
    canDistributePrize?: boolean;
    canManageWallet?: boolean;
  };
}

export const accessKeys = {
  list: () => request<{ keys: AdminAccessKey[]; count: number }>('/admin/access'),

  issue: (input: IssueAccessInput) =>
    request<IssuedAccessKey>('/admin/access', {
      method: 'POST',
      body: JSON.stringify(input),
      stepUp: true,
    }),

  revoke: (id: string) => request<null>(`/admin/access/${id}/revoke`, { method: 'POST' }),

  regenerate: (id: string) =>
    request<IssuedAccessKey>(`/admin/access/${id}/regenerate`, { method: 'POST', stepUp: true }),
};

// ── Runtime tenant settings (owner only) ────────────────────────────────

export const settings = {
  get: () => request<TenantSettings>('/admin/tenant/settings'),

  update: (input: Partial<TenantSettings>) =>
    request<TenantSettings>('/admin/tenant/settings', {
      method: 'PATCH',
      body: JSON.stringify(input),
      stepUp: true,
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


/**
 * Manage Matches — the one-screen control room. Every call returns the whole
 * board so the page never has to guess what changed.
 */
export const manage = {
  list: (filter: 'live' | 'upcoming' | 'all' | 'closed' = 'all', q?: string) => {
    const params = new URLSearchParams({ filter });
    if (q?.trim()) params.set('q', q.trim());
    return request<ManageMatchListResult>(`/admin/matches/manage?${params.toString()}`);
  },

  board: (matchId: string) => request<ManageBoard>(`/admin/matches/${matchId}/live-board`),

  setKills: (matchId: string, userId: string, kills: number) =>
    request<ManageBoard>(`/admin/matches/${matchId}/participants/${userId}/kills`, {
      method: 'PATCH',
      body: JSON.stringify({ kills }),
    }),

  setDone: (matchId: string, userId: string, done: boolean) =>
    request<ManageBoard>(`/admin/matches/${matchId}/participants/${userId}/done`, {
      method: 'POST',
      body: JSON.stringify({ done }),
    }),

  refund: (matchId: string, userId: string, reason?: string) =>
    request<ManageBoard>(`/admin/matches/${matchId}/participants/${userId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason?.trim() || undefined }),
    }),

  /**
   * Banned seat money switch (coin icon): true = entry fee back to the player,
   * false = ban only (takes a refund back if one was already given).
   */
  setBanRefund: (matchId: string, userId: string, refund: boolean) =>
    request<ManageBoard>(`/admin/matches/${matchId}/participants/${userId}/ban-refund`, {
      method: 'PATCH',
      body: JSON.stringify({ refund }),
    }),

  ban: (matchId: string, userId: string, isBanned: boolean, reason?: string) =>
    request<unknown>(`/admin/matches/${matchId}/participants/${userId}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned, reason: reason?.trim() || undefined }),
    }),

  publishRoom: (matchId: string, roomId: string, roomPassword: string) =>
    request<MatchRoomCredentials>(`/tournaments/${matchId}/room`, {
      method: 'PATCH',
      body: JSON.stringify({ roomId, roomPassword }),
    }),

  goLive: (matchId: string) =>
    request<AdminTournament>(`/tournaments/${matchId}/go-live`, { method: 'PATCH' }),

  cancel: (matchId: string, reason: string) =>
    request<CancelMatchResult>(`/tournaments/${matchId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  payout: (matchId: string, awards: PayoutAwardInput[], completeMatch = true, allowOverPool = false) =>
    request<PayoutAwardsResult>(`/admin/matches/${matchId}/payout`, {
      method: 'POST',
      body: JSON.stringify({ awards, completeMatch, allowOverPool }),
      stepUp: true,
    }),

  /**
   * Hand a scored match to the Final Payout desk. No money moves — the match
   * leaves the live control room and waits there for the OTP payout.
   */
  submitForPayout: (matchId: string) =>
    request<{ tournamentId: string; payoutSubmittedAt: string; alreadySubmitted: boolean }>(
      `/admin/matches/${matchId}/submit`,
      { method: 'POST' },
    ),

  /** Final Payout desk: submitted matches + the money totals for each. */
  payoutInbox: (filter: PayoutFilterTab = 'pending', q?: string) => {
    const params = new URLSearchParams({ filter });
    if (q?.trim()) params.set('q', q.trim());
    return request<PayoutInbox>(`/admin/matches/payouts/inbox?${params.toString()}`);
  },
};

export const api = {
  auth,
  stepUp,
  security,
  matches,
  wallet,
  players,
  accessKeys,
  settings,
  manage,
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
