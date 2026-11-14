import { realtimeUrl } from './api';

/**
 * Realtime gateway client.
 *
 * The backend broadcasts tenant-scoped events (MATCH_CREATED, SLOT_BOOKED, room
 * reveal, wallet). The admin console only needs a *signal* — it debounces a
 * refetch — so no event payload is trusted here.
 *
 * The admin cookie is httpOnly, so the socket subscribes by `tenantId` only
 * (the gateway supports tenant-scoped listeners).
 */
export interface RealtimeMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

export type RealtimeHandler = (message: RealtimeMessage) => void;
export type RealtimeStatus = 'connecting' | 'open' | 'closed';
export type RealtimeStatusHandler = (status: RealtimeStatus) => void;

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_SECONDS = 10;

export function connectRealtime(
  onMessage: RealtimeHandler,
  onStatus?: RealtimeStatusHandler
): () => void {
  let socket: WebSocket | null = null;
  let pingTimer: number | undefined;
  let reconnectTimer: number | undefined;
  let attempt = 0;
  let closedByUs = false;

  const stopHeartbeat = () => {
    if (pingTimer !== undefined) {
      window.clearInterval(pingTimer);
      pingTimer = undefined;
    }
  };

  const open = () => {
    const url = realtimeUrl();
    if (!url || closedByUs) return;

    onStatus?.('connecting');
    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
      onStatus?.('open');
      stopHeartbeat();
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'PING' }));
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        /* a malformed frame must never break the console */
      }
    };

    socket.onclose = () => {
      stopHeartbeat();
      socket = null;
      onStatus?.('closed');
      if (closedByUs) return;
      attempt = Math.min(attempt + 1, MAX_BACKOFF_SECONDS);
      reconnectTimer = window.setTimeout(open, attempt * 1000);
    };

    socket.onerror = () => {
      /* onclose always follows */
    };
  };

  open();

  return () => {
    closedByUs = true;
    onStatus?.('closed');
    stopHeartbeat();
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
  };
}
