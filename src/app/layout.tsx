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
        <title>World Cup Prediction Market</title>
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <DappGuard>
              {children}
            </DappGuard>
            <BottomNavWrapper />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
