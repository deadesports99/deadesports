/**
 * Realtime lobby socket (same gateway the Android app uses: `<origin>/ws`).
 *
 * Why this exists: the feed used to be fetched once on sign-in, so a match that
 * the admin published while a player was staring at the lobby stayed invisible
 * until they tapped the refresh chip. The server now pushes MATCH_CREATED (and
 * SLOT_BOOKED / status events), and this socket turns those into a refetch.
 *
 * The socket reconnects with a small backoff, so a sleeping laptop or a flaky
 * mobile network recovers on its own.
 */
import { realtimeUrl } from './api';

export interface RealtimeMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  serverTimeMs?: number;
}

export type RealtimeHandler = (message: RealtimeMessage) => void;

const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_SECONDS = 8;

/**
 * Opens the gateway and keeps it open. Returns a cleanup function that closes
 * the socket and cancels any pending reconnect.
 */
export function connectRealtime(onMessage: RealtimeHandler): () => void {
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

    socket = new WebSocket(url);

    socket.onopen = () => {
      attempt = 0;
      stopHeartbeat();
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'PING' }));
        }
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        /* a malformed frame must never break the lobby */
      }
    };

    socket.onclose = () => {
      stopHeartbeat();
      socket = null;
      if (closedByUs) return;
      attempt = Math.min(attempt + 1, MAX_BACKOFF_SECONDS);
      reconnectTimer = window.setTimeout(open, attempt * 1000);
    };

    socket.onerror = () => {
      // onclose always follows; reconnection is handled there.
    };
  };

  open();

  return () => {
    closedByUs = true;
    stopHeartbeat();
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
  };
}
