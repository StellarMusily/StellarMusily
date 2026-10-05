'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProgress, type Progress } from '@/lib/api';
import { connectWallet } from '@/lib/stellar';

type Ctx = {
  address: string | null;
  progress: Progress | null;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
  setProgress: (p: Progress) => void;
  error: string | null;
};

const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (address) setProgress(await getProgress(address).catch(() => null));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = async () => {
    try {
      setError(null);
      setAddress(await connectWallet());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect. Is Freighter installed?');
    }
  };

  return (
    <WalletContext.Provider value={{ address, progress, connect, refresh, setProgress, error }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
