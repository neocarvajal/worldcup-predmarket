"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface BetSelection {
  fixtureId: number;
  fixtureName: string;
  selection: string;
  odds: number;
  label: string;
  startTime?: number;
}

interface BetSlipState {
  selections: BetSelection[];
  amount: string;
  addSelection: (s: BetSelection) => void;
  removeSelection: (fixtureId: number, selection: string) => void;
  clear: () => void;
  setAmount: (a: string) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
}

const BetSlipContext = createContext<BetSlipState | null>(null);

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const addSelection = useCallback((s: BetSelection) => {
    setSelections(prev => {
      const existing = prev.findIndex(
        x => x.fixtureId === s.fixtureId && x.selection === s.selection
      );
      if (existing >= 0) return prev;
      return [...prev, s];
    });
    setIsOpen(true);
  }, []);

  const removeSelection = useCallback((fixtureId: number, selection: string) => {
    setSelections(prev => prev.filter(
      x => !(x.fixtureId === fixtureId && x.selection === selection)
    ));
  }, []);

  const clear = useCallback(() => {
    setSelections([]);
    setAmount('');
    setIsOpen(false);
  }, []);

  return (
    <BetSlipContext.Provider value={{
      selections, amount, isOpen,
      addSelection, removeSelection, clear, setAmount, setIsOpen,
    }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip(): BetSlipState {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error('useBetSlip must be used within BetSlipProvider');
  return ctx;
}
