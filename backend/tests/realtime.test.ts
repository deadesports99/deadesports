/**
 * Realtime gateway over a REAL websocket: connection ack with server time,
 * token auth handshake, PING/PONG keep-alive, and targeted fan-out
 * (user, users, tenant, broadcast).
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';

process.env.NODE_ENV = 'test';

type RealtimeApi = typeof import('../src/services/realtime.service.js');
let svc: RealtimeApi['realtimeService'];
let env: typeof import('../src/config/env.js').env;
let server: http.Server;
let port = 0;

/** Collects every message a socket receives. */
function socket(query = '') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
  const messages: any[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  return { ws, messages };
}

async function waitFor(predicate: () => boolean, label: string) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > 3000) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

before(async () => {
  env = (await import('../src/config/env.js')).env;
  const { realtimeService } = await import('../src/services/realtime.service.js');
  svc = realtimeService;

  server = http.createServer((_req, res) => res.end('ok'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
  svc.init(server);
});

after(() => {
  svc.shutdown();
  server.close();
});

const tokenFor = (userId: string, tenantId = 'tenant-1') =>
  jwt.sign({ userId, tenantId, role: 'USER' }, env.JWT_SECRET, { expiresIn: '1h' });

describe('realtime gateway', () => {
  it('acknowledges a connection with authoritative server time', async () => {
    const client = socket();
    await waitFor(() => client.messages.length > 0, 'CONNECTED');

    const ack = client.messages[0];
    assert.equal(ack.type, 'CONNECTED');
    assert.equal(ack.timezone, 'Asia/Kolkata');
    assert.match(ack.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(ack.serverTimeMs > 0);
    assert.ok(ack.serverTimeIst);
    client.ws.close();
  });

  it('authenticates via query string and answers PING with PONG', async () => {
    const client = socket(`?token=${tokenFor('player-1')}&tenantId=tenant-1`);
    await waitFor(() => client.messages.length > 0, 'CONNECTED');

    client.ws.send(JSON.stringify({ type: 'PING' }));
    await waitFor(() => client.messages.some((m) => m.type === 'PONG'), 'PONG');
    const pong = client.messages.find((m) => m.type === 'PONG');
    assert.ok(pong.serverTimeMs > 0);
    client.ws.close();
  });

  it('accepts an AUTH handshake and rejects a bad one', async () => {
    const good = socket();
    await waitFor(() => good.messages.length > 0, 'CONNECTED');
    good.ws.send(JSON.stringify({ type: 'AUTH', token: tokenFor('player-2') }));
    await waitFor(() => good.messages.some((m) => m.type === 'AUTH_SUCCESS'), 'AUTH_SUCCESS');
    assert.equal(good.messages.find((m) => m.type === 'AUTH_SUCCESS').userId, 'player-2');

    const bad = socket();
    await waitFor(() => bad.messages.length > 0, 'CONNECTED');
    bad.ws.send(JSON.stringify({ type: 'AUTH', token: 'nope' }));
    await waitFor(() => bad.messages.some((m) => m.type === 'AUTH_ERROR'), 'AUTH_ERROR');

    // Garbage payloads are ignored instead of crashing the gateway.
    bad.ws.send('not-json');
    good.ws.close();
    bad.ws.close();
  });

  it('broadcasts to everyone, and targets users and tenants', async () => {
    const alpha = socket(`?token=${tokenFor('alpha')}&tenantId=tenant-1`);
    const beta = socket(`?token=${tokenFor('beta', 'tenant-2')}&tenantId=tenant-2`);
    await waitFor(() => alpha.messages.length > 0 && beta.messages.length > 0, 'both connected');

    svc.broadcast('MATCH_STATUS_CHANGED', { tournamentId: 't1', status: 'LIVE' });
    await waitFor(
      () => [alpha, beta].every((c) => c.messages.some((m) => m.type === 'MATCH_STATUS_CHANGED')),
      'broadcast',
    );
    const broadcastMessage = alpha.messages.find((m) => m.type === 'MATCH_STATUS_CHANGED');
    assert.deepEqual(broadcastMessage.data, { tournamentId: 't1', status: 'LIVE' });
    assert.ok(broadcastMessage.serverTimeMs > 0);

    svc.sendToUser('alpha', 'WALLET_UPDATED', { balance: 250 });
    await waitFor(() => alpha.messages.some((m) => m.type === 'WALLET_UPDATED'), 'targeted message');
    assert.equal(beta.messages.some((m) => m.type === 'WALLET_UPDATED'), false, 'other players never see it');

    svc.sendToUsers(['alpha', 'ghost'], 'PRIZE_WON', { amount: 240 });
    await waitFor(() => alpha.messages.filter((m) => m.type === 'PRIZE_WON').length === 1, 'multi-user message');

    svc.broadcastToTenant('tenant-1', 'DEPOSIT_APPROVED', { amount: 500 });
    await waitFor(() => alpha.messages.some((m) => m.type === 'DEPOSIT_APPROVED'), 'tenant message');
    assert.equal(
      beta.messages.some((m) => m.type === 'DEPOSIT_APPROVED'),
      false,
      'tenant-2 is isolated',
    );

    alpha.ws.close();
    beta.ws.close();
  });

  it('drops closed clients so broadcasts never hit a dead socket', async () => {
    const client = socket();
    await waitFor(() => client.messages.length > 0, 'CONNECTED');
    client.ws.close();
    await new Promise((r) => setTimeout(r, 60));
    assert.doesNotThrow(() => svc.broadcast('MATCH_STATUS_CHANGED', { tournamentId: 't2' }));
  });
});
