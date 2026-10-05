import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { WalletProvider } from '@/components/WalletProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tempo — learn an instrument, level up',
  description: 'Gamified music courses with payments and certificates on Stellar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Header />
          <main className="container">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
