"use client";

/**
 * BottomNavWrapper — Conditional bottom navigation
 * ==================================================
 * Hides the BottomNav on the landing page (/) to provide a full-screen
 * marketing experience. Renders the nav on all other app routes.
 */

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';

export const BottomNavWrapper: React.FC = () => {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <BottomNav />;
};
