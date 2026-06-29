"use client";

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';

export const BottomNavWrapper: React.FC = () => {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <BottomNav />;
};
