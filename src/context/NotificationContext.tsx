"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'settled' | 'won' | 'lost' | 'info';
  timestamp: number;
  read: boolean;
  escrowPubkey?: string;
  path?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  notificationsEnabled: boolean;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleNotifications: () => void;
}

const STORAGE_KEY = 'txline:notifications';
const ENABLED_KEY = 'txline:notifications-enabled';

const NotificationContext = createContext<NotificationState | null>(null);

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    setNotifications(loadNotifications());
    setInitialized(true);
    try {
      const stored = localStorage.getItem(ENABLED_KEY);
      if (stored !== null) setNotificationsEnabled(stored === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    if (initialized) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)); } catch {}
    }
  }, [notifications, initialized]);

  useEffect(() => {
    try { localStorage.setItem(ENABLED_KEY, String(notificationsEnabled)); } catch {}
  }, [notificationsEnabled]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications(prev => [{ ...n, id, timestamp: Date.now(), read: false }, ...prev.slice(0, 49)]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => !prev);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, notificationsEnabled, addNotification, markAsRead, markAllAsRead, clearAll, toggleNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
