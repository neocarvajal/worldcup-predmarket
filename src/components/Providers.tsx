// src/components/Providers.tsx
"use client";

import React, { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { TxLineProvider } from '../context/TxLineContext';
import { LiveOddsProvider } from '../context/LiveOddsContext';
import { BetSlipProvider } from '../context/BetSlipContext';
import { NotificationProvider } from '../context/NotificationContext';
import { MatchWatcherProvider } from '../context/MatchWatcherContext';
import { NavBar } from './NavBar';
import '@solana/wallet-adapter-react-ui/styles.css';

const network = WalletAdapterNetwork.Devnet;
const endpoint = 
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOLANA_RPC) ||
  clusterApiUrl(network);

if (typeof window !== 'undefined' && typeof (process as any)?.setMaxListeners === 'function') {
  try { (process as any).setMaxListeners(100); } catch {}
}

export const Providers: React.FC<{children: ReactNode}> = ({ children }) => {
  const wallets = useMemo(() => [
    new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
          name: 'WorldCup PredMarket',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://worldcup-hackathon.vercel.app',
        icon: '/favicon.svg',
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      chain: 'solana:devnet',
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    }),
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect wallets={wallets}>
        <WalletModalProvider>
          <TxLineProvider>
            <LiveOddsProvider>
            <BetSlipProvider>
              <NotificationProvider>
                <MatchWatcherProvider>
                  <div className="flex flex-col min-h-screen bg-primary">
                    <NavBar />
                    <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
                      {children}
                    </main>
                  </div>
                </MatchWatcherProvider>
              </NotificationProvider>
            </BetSlipProvider>
            </LiveOddsProvider>
          </TxLineProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
