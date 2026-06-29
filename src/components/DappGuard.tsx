"use client";

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
