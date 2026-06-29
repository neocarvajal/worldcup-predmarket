"use client";
import React, { createContext, useContext } from 'react';
import { txLineClient, TxLineAuthError } from '../txlineSkill';
export { TxLineAuthError };

interface TxLineContextProps {
  client: typeof txLineClient;
}

const TxLineContext = createContext<TxLineContextProps | undefined>(undefined);

export const TxLineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <TxLineContext.Provider value={{ client: txLineClient }}>
      {children}
    </TxLineContext.Provider>
  );
};

export const useTxLine = () => {
  const ctx = useContext(TxLineContext);
  if (!ctx) {
    throw new Error('useTxLine must be used within TxLineProvider');
  }
  return ctx;
};
