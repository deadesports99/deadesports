/**
 * One-shot proof that the Firestore live mirror can actually write.
 *
 * Run this on the machine that holds the real service account, BEFORE flipping
 * FIREBASE_LIVE_MIRROR=true in production:
 *
 *   npm run verify:mirror
 *
 * It publishes a single `MIRROR_PING` event through the exact same code path the
 * gateway uses and reports what happened. Nothing else in the app is touched and
 * no player-visible event is emitted. The document it writes carries
 * `data.source: "verify-script"` so it is easy to spot and delete.
 */
import 'dotenv/config';
import { liveMirrorService } from '../services/liveMirror.service.js';
import { env } from '../config/env.js';

async function main(): Promise<void> {
  liveMirrorService.init();

  if (!liveMirrorService.isEnabled()) {
    console.error(
      '\n✖ Live mirror is OFF.\n' +
        '  Check both of these, then run again:\n' +
        '    FIREBASE_LIVE_MIRROR=true\n' +
        '    FCM_CREDENTIALS_JSON=<service-account json, one line>\n',
    );
    process.exitCode = 1;
    return;
  }

  console.log(`→ collection      : ${env.FIREBASE_LIVE_MIRROR_COLLECTION}`);
  console.log(`→ batch / queue   : ${env.FIREBASE_LIVE_MIRROR_BATCH_SIZE} / ${env.FIREBASE_LIVE_MIRROR_MAX_QUEUE}`);
  console.log(`→ ttl hours       : ${env.FIREBASE_LIVE_MIRROR_TTL_HOURS}`);
  console.log('→ publishing one MIRROR_PING event…\n');

  liveMirrorService.publish(
    {
      type: 'MIRROR_PING',
      data: { source: 'verify-script', note: 'safe to delete' },
      timestamp: new Date().toISOString(),
    },
    { audience: 'ALL' },
  );

  await liveMirrorService.flush();
  const stats = liveMirrorService.stats();

  console.log('stats:', JSON.stringify(stats));

  if (stats.written > 0) {
    console.log(
      '\n✔ Write accepted by Firestore.\n' +
        '  Open Firebase console → Firestore → ' +
        `${env.FIREBASE_LIVE_MIRROR_COLLECTION} and look for type "MIRROR_PING".\n`,
    );
    return;
  }

  console.error(
    '\n✖ Firestore rejected the write (see the [liveMirror] warning above).\n' +
      '  Usual causes: the service account lacks the "Cloud Datastore User" role,\n' +
      '  or Firestore has never been enabled for this project.\n',
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('✖ verify:mirror crashed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
