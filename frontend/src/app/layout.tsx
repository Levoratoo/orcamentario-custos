import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '@/components/providers/app-providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nexora | Planejamento Orcamentario',
  description: 'Planejamento Orcamentario por Coordenador',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
