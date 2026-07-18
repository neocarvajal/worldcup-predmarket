'use client';

/**
 * PushToggle — Web push notification toggle
 * ===========================================
 * Button that invokes the usePushNotifications hook to subscribe or
 * unsubscribe the browser from VAPID push notifications. Shows current
 * state: On, Off, Blocked, Error, or Loading (spinner). Styled with
 * contextual colors (green for on, red for blocked/error).
 */

import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { BellIcon, ReloadIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';

export function PushToggle({ wallet }: { wallet?: string }) {
  const { state, subscribe, unsubscribe } = usePushNotifications(wallet);

  if (state === 'unsupported') return null;

  const icon = state === 'subscribed' ? <CheckCircledIcon width={14} height={14} /> :
    state === 'subscribing' ? <ReloadIcon width={14} height={14} className="animate-spin" /> :
    <BellIcon width={14} height={14} />;

  const label = state === 'subscribed' ? 'On' :
    state === 'subscribing' ? '...' :
    state === 'denied' ? 'Bloqueadas' :
    state === 'error' ? 'Error' :
    'Off';

  const bg = state === 'subscribed' ? 'rgba(34,197,94,0.08)' :
    state === 'denied' || state === 'error' ? 'rgba(255,68,68,0.08)' :
    'var(--bg-surface)';

  const color = state === 'subscribed' ? 'var(--success)' :
    state === 'denied' || state === 'error' ? 'var(--danger)' :
    'var(--text-muted)';

  const borderColor = state === 'subscribed' ? 'rgba(34,197,94,0.2)' :
    state === 'denied' || state === 'error' ? 'rgba(255,68,68,0.2)' :
    'var(--border)';

  const handleClick = () => {
    if (state === 'subscribed') unsubscribe();
    else subscribe();
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
        style={{ background: bg, color, border: `1px solid ${borderColor}` }}
      >
        {icon}
        {label}
      </span>
      {(state === 'prompt' || state === 'granted' || state === 'subscribed' || state === 'error') && (
        <button
          onClick={handleClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-200 active:scale-95"
          style={{
            background: state === 'subscribed' ? 'rgba(255,68,68,0.1)' : 'var(--accent)',
            color: state === 'subscribed' ? 'var(--danger)' : '#000',
          }}
        >
          {state === 'subscribed' ? 'Desactivar' : state === 'error' ? 'Reintentar' : 'Activar'}
        </button>
      )}
    </div>
  );
}
