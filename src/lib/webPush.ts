/**
 * VAPID Web Push notification delivery
 * =====================================
 * Server-side utility for sending push notifications via the Web Push Protocol.
 * Uses the `web-push` npm package with VapidDetails configured from env vars.
 * The `sendPushToAll` function handles batch delivery, tracking sent vs expired
 * subscriptions for observability.
 */

import webPush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:neocarvajal@gmail.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export function isVapidConfigured(): boolean {
  return !!(vapidPublicKey && vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
  if (!isVapidConfigured()) {
    return { ok: false, error: 'VAPID not configured' };
  }

  try {
    const result = await webPush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      JSON.stringify(payload),
      { TTL: 86400 }
    );
    return { ok: true, statusCode: result.statusCode };
  } catch (e: any) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      return { ok: false, statusCode: e.statusCode, error: 'Subscription expired' };
    }
    return { ok: false, statusCode: e.statusCode, error: e.message };
  }
}

export async function sendPushToAll(
  subscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>,
  payload: PushPayload
): Promise<{ sent: number; expired: number }> {
  let sent = 0;
  let expired = 0;

  for (const sub of subscriptions) {
    const result = await sendPush(sub, payload);
    if (result.ok) {
      sent++;
    } else if (result.statusCode === 410 || result.statusCode === 404) {
      expired++;
    }
  }

  return { sent, expired };
}
