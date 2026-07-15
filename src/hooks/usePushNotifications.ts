'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

type PushState = 'unsupported' | 'denied' | 'prompt' | 'granted' | 'subscribing' | 'subscribed' | 'error';

export function usePushNotifications(wallet?: string | null) {
  const [state, setState] = useState<PushState>('prompt');
  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const subRef = useRef<PushSubscription | null>(null);

  const urlBase64ToUint8Array = useCallback((base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from(rawData.split('').map((ch) => ch.charCodeAt(0)));
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }

    try {
      setState('subscribing');

      const registration = await navigator.serviceWorker.register('/sw.js');
      swRef.current = registration;
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        // Stale browser sub without Supabase record — unsubscribe and re-subscribe
        await existing.unsubscribe();
        subRef.current = null;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setState('error');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      subRef.current = subscription;

      const subJson = subscription.toJSON();
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet || null,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });
      if (!subRes.ok) {
        setState('error');
        return;
      }

      setState('subscribed');
    } catch {
      setState('error');
    }
  }, [wallet, urlBase64ToUint8Array]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }

    async function check() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        swRef.current = registration;
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          subRef.current = existing;
          // Verify subscription is stored in Supabase
          try {
            const subJson = existing.toJSON();
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (supabaseUrl && anonKey && subJson.endpoint) {
              const checkRes = await fetch(
                `${supabaseUrl}/rest/v1/push_subscriptions?select=id&endpoint=eq.${encodeURIComponent(subJson.endpoint)}`,
                { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } }
              );
              const rows = await checkRes.json();
              if (!Array.isArray(rows) || rows.length === 0) {
                // Stale subscription — unsubscribe browser, show correct state
                await existing.unsubscribe();
                subRef.current = null;
                setState(Notification.permission === 'granted' ? 'granted' : 'prompt');
                return;
              }
            }
          } catch {
            // Can't verify, assume it's valid
          }
          setState('subscribed');
          return;
        }

        if (Notification.permission === 'denied') {
          setState('denied');
          return;
        }

        if (Notification.permission === 'granted') {
          setState('granted');
          return;
        }

        setState('prompt');
      } catch {
        setState('unsupported');
      }
    }

    check();
  }, []);

  const unsubscribe = useCallback(async () => {
    const sub = subRef.current;
    if (sub) {
      await sub.unsubscribe();
      subRef.current = null;

      const subJson = sub.toJSON();
      if (subJson.endpoint) {
        fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subJson.endpoint)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    }
    setState('prompt');
  }, []);

  return { state, subscribe, unsubscribe };
}
