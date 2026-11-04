import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type RealtimeEventType =
  | 'SLOT_BOOKED'
  | 'MATCH_STATUS_CHANGED'
  | 'WALLET_UPDATED'
  | 'ROOM_CREDENTIALS_REVEALED'
  | 'DEPOSIT_APPROVED'
  | 'PRIZE_WON';

export interface RealtimeMessage {
  type: RealtimeEventType;
  data: any;
  timestamp: string;
}

interface ClientMeta {
  ws: WebSocket;
  userId?: string;
  tenantId?: string;
  isAlive: boolean;
}

class RealtimeService {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientMeta> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const meta: ClientMeta = {
        ws,
        isAlive: true,
      };

      // Extract optional query params e.g. /ws?token=...&tenantId=...
      try {
        const fullUrl = `http://localhost${req.url || '/ws'}`;
        const parsed = new URL(fullUrl);
        const token = parsed.searchParams.get('token');
        const tenantId = parsed.searchParams.get('tenantId');

        if (tenantId) meta.tenantId = tenantId;

        if (token) {
          try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as { id?: string; userId?: string; tenantId?: string };
            meta.userId = decoded.id || decoded.userId;
            if (decoded.tenantId) meta.tenantId = decoded.tenantId;
          } catch {
            // Invalid token - keep connection open for public match updates
          }
        }
      } catch (err) {
        // Fallback for url parsing
      }

      this.clients.add(meta);

      // Handle incoming messages (e.g. auth handshake after connection)
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'AUTH' && msg.token) {
            try {
              const decoded = jwt.verify(msg.token, env.JWT_SECRET) as { id?: string; userId?: string; tenantId?: string };
              meta.userId = decoded.id || decoded.userId;
              if (decoded.tenantId) meta.tenantId = decoded.tenantId;
              ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: meta.userId }));
            } catch {
              ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid token' }));
            }
          } else if (msg.type === 'PING') {
            meta.isAlive = true;
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
          }
        } catch {
          // Ignore invalid client payload
        }
      });

      ws.on('pong', () => {
        meta.isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(meta);
      });

      ws.on('error', () => {
        this.clients.delete(meta);
      });

      // Send initial connection ack
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        data: { message: '⚡ Free Fire Realtime Engine Connected' },
        timestamp: new Date().toISOString(),
      }));
    });

    // Heartbeat check every 30s
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30_000);

    console.log('⚡ Realtime WebSocket Gateway mounted at /ws');
  }

  public broadcast(type: RealtimeEventType, data: any): void {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public broadcastToTenant(tenantId: string, type: RealtimeEventType, data: any): void {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN && (!client.tenantId || client.tenantId === tenantId)) {
        client.ws.send(payload);
      }
    }
  }

  public sendToUser(userId: string, type: RealtimeEventType, data: any): void {
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public sendToUsers(userIds: string[], type: RealtimeEventType, data: any): void {
    const targetSet = new Set(userIds);
    const payload = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.userId && targetSet.has(client.userId) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      for (const client of this.clients) {
        client.ws.close();
      }
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

export const realtimeService = new RealtimeService();
