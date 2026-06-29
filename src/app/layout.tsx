import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';

import { Providers } from '../components/Providers';
import { BottomNavWrapper } from '../components/BottomNavWrapper';
import { DappGuard } from '../components/DappGuard';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>World Cup Prediction Market</title>
      </head>
      <body className={inter.className}>
        <Providers>
          <DappGuard>
            {children}
          </DappGuard>
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  );
}
