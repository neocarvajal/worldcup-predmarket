import './globals.css';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { Providers } from '../components/Providers';
import { BottomNavWrapper } from '../components/BottomNavWrapper';
import { DappGuard } from '../components/DappGuard';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <title>WorldCup PredMarket</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <DappGuard>
              {children}
            </DappGuard>
          </Providers>
          <BottomNavWrapper />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
