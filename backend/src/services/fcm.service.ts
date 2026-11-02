import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

/**
 * FCM push engine — lazy singleton so the backend boots fine without Firebase
 * credentials (push simply no-ops with a warning; the API stays fully usable).
 *
 * Credentials come from `FCM_CREDENTIALS_JSON` (the full service-account JSON
 * as a string) or the standard GOOGLE_APPLICATION_CREDENTIALS file.
 */
let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;

  try {
    if (env.FCM_CREDENTIALS_JSON) {
      const serviceAccount = JSON.parse(env.FCM_CREDENTIALS_JSON);
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp({ credential: applicationDefault() });
    }
    initialized = true;
    console.log('[fcm] Firebase initialized — push notifications ENABLED');
  } catch (err) {
    console.warn('[fcm] Firebase not configured, push notifications disabled:', (err as Error).message);
  }
}

export interface PushPayload {
  type: 'ROOM_REVEALED' | 'PRIZE_WON' | 'MATCH_CANCELLED';
  tournamentId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const TYPE_NOTIFICATION_CHANNEL: Record<PushPayload['type'], string> = {
  ROOM_REVEALED: 'ff_room_alerts',
  PRIZE_WON: 'ff_prize_alerts',
  MATCH_CANCELLED: 'ff_refund_alerts',
};

/** Send an alert to every confirmed participant of a tournament (their FCM tokens). */
export async function pushToTournamentParticipants(
  tournamentId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const slots = await prisma.tournamentSlot.findMany({
      where: { tournamentId },
      select: { user: { select: { fcmToken: true } } },
    });
    await sendPush(
      slots.map((s) => s.user.fcmToken),
      payload,
    );
  } catch (err) {
    console.error('[fcm] participant push failed:', (err as Error).message);
  }
}

/** Send an alert to specific users by id (e.g. just the prize winners). */
export async function pushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(userIds)] } },
      select: { fcmToken: true },
    });
    await sendPush(
      users.map((u) => u.fcmToken),
      payload,
    );
  } catch (err) {
    console.error('[fcm] user push failed:', (err as Error).message);
  }
}
/** Send a high-priority alert to a batch of FCM tokens (dedup + skip blanks). */
export async function sendPush(
  tokens: Array<string | null | undefined>,
  payload: PushPayload,
): Promise<void> {
  ensureInitialized();
  if (!initialized) return;

  const uniqueTokens = [...new Set(tokens.filter((t): t is string => Boolean(t)))];
  if (uniqueTokens.length === 0) return;

  try {
    await getMessaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title: payload.title, body: payload.body },
      android: {
        priority: 'high',
        notification: {
          channelId: TYPE_NOTIFICATION_CHANNEL[payload.type],
          sound: 'default',
          priority: 'high',
          defaultVibrateTimings: true,
        },
      },
      data: {
        type: payload.type,
        tournamentId: payload.tournamentId,
        ...(payload.data ?? {}),
      },
    });
  } catch (err) {
    console.error('[fcm] send failed:', (err as Error).message);
  }
}