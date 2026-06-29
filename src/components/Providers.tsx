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
import { BetSlipProvider } from '../context/BetSlipContext';
import { NavBar } from './NavBar';
import '@solana/wallet-adapter-react-ui/styles.css';

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

export const Providers: React.FC<{children: ReactNode}> = ({ children }) => {
  const wallets = useMemo(() => [
    new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        name: 'World Cup Predictions',
        uri: typeof window !== 'undefined' ? window.location.origin : 'https://worldcup-hackathon.vercel.app',
        icon: '/favicon.ico',
      },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      chain: 'solana:devnet',
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    }),
    new PhantomWalletAdapter(),
    new BackpackWalletAdapter(),
    new SolflareWalletAdapter({ network }),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider autoConnect wallets={wallets}>
        <WalletModalProvider>
          <TxLineProvider>
            <BetSlipProvider>
              <div className="flex flex-col min-h-screen bg-primary">
                <NavBar />
                <main className="flex-1 pb-20 overflow-y-auto">
                  {children}
                </main>
              </div>
            </BetSlipProvider>
          </TxLineProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
