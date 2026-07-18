"use client";

/**
 * DappGuard — Route-level SubscriptionGuard wrapper
 * ===================================================
 * Conditionally renders SubscriptionGuard on all routes except the
 * landing page (/). Ensures wallet-based access control without
 * blocking unauthenticated users on the marketing landing page.
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import { SubscriptionGuard } from './SubscriptionGuard';

export const DappGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLanding = pathname === '/';

  if (isLanding) {
    return <>{children}</>;
  }

  return <SubscriptionGuard>{children}</SubscriptionGuard>;
};
