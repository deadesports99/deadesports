import { app } from './app.js';
import { env } from './config/env.js';
import { assertPaymentConfig } from './config/payment.js';
import { disconnectPrisma } from './config/prisma.js';
import { disconnectRedis } from './config/redis.js';
import { startMatchSweepScheduler, stopMatchSweepScheduler } from './services/matchSweep.service.js';
import { expireStalePaymentOrders } from './services/payment.settlement.js';
import { realtimeService } from './services/realtime.service.js';

// Fail fast before accepting traffic: a misconfigured gateway must never
// surface as a broken "Add Money" button for players.
assertPaymentConfig();

/**
 * HTTP server listener with graceful shutdown.
 * On SIGINT / SIGTERM we: stop accepting connections -> close HTTP server
 * -> disconnect Prisma -> disconnect Redis -> exit cleanly.
 */
const server = app.listen(env.PORT, () => {
  console.log('┌─────────────────────────────────────────────┐');
  console.log(`│  🚀 Server running in ${env.NODE_ENV.toUpperCase()} mode          │`);
  console.log(`│  ➜ http://localhost:${env.PORT}                    │`);
  console.log(`│  ➜ Health: /health , /api/v1/health               │`);
  console.log('└─────────────────────────────────────────────┘');
});

// 🕒 Auto lifecycle sweep: UPCOMING/OPEN -> ROOM_REVEALED (T-15) -> LIVE.
// Runs in-process every minute; safe to run alongside an external cron.
realtimeService.init(server);
startMatchSweepScheduler();

// 💳 Payment checkout sweep: CREATED/PENDING orders past `expiresAt` become
// EXPIRED. A late gateway success can still be settled (the settlement claim
// accepts any non-CAPTURED status), so no player money is lost here.
let paymentSweepRunning = false;
const paymentSweepTimer = setInterval(() => {
  if (paymentSweepRunning) return;
  paymentSweepRunning = true;
  void expireStalePaymentOrders()
    .then((count) => {
      if (count > 0) console.log(`💳 Expired ${count} stale payment order(s).`);
    })
    .catch((err) => console.error('✖ Payment order sweep failed:', err))
    .finally(() => {
      paymentSweepRunning = false;
    });
}, env.PAYMENT_EXPIRY_SWEEP_INTERVAL_MS);
paymentSweepTimer.unref?.();

const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n⚠ ${signal} received — shutting down gracefully...`);
  stopMatchSweepScheduler();
  clearInterval(paymentSweepTimer);
  realtimeService.shutdown();

  // Hard fail-safe: force exit if connections refuse to close.
  const forceExitTimer = setTimeout(() => {
    console.error('⚠ Forced shutdown after timeout.');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  server.close(async (closeErr) => {
    try {
      console.log('● HTTP server closed.');
      await disconnectPrisma();
      console.log('● Prisma disconnected.');
      await disconnectRedis();
      console.log('● Redis disconnected.');
      console.log('✔ Clean shutdown complete. Bye!');
      process.exit(closeErr ? 1 : 0);
    } catch (err) {
      console.error('✖ Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Uncaught errors should never kill the process silently.
process.on('uncaughtException', (err) => {
  console.error('✖ Uncaught exception:', err);
  void shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('✖ Unhandled promise rejection:', reason);
});