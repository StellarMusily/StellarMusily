'use client';

import Link from 'next/link';
import { useWallet } from './WalletProvider';
import { XpBar } from './XpBar';

export function Header() {
  const { address, progress, connect, error } = useWallet();
  return (
    <header className="header">
      <Link href="/" className="logo">
        ♪ Tempo
      </Link>
      <div className="header-right">
        {progress && <XpBar progress={progress} compact />}
        {address ? (
          <span className="pill" title={address}>
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
        ) : (
          <button className="btn" onClick={connect}>
            Connect Freighter
          </button>
        )}
      </div>
      {error && <p className="error header-error">{error}</p>}
    </header>
  );
}
