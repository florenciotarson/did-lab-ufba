// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Identidade Soberana (DID/SSI)',
  description: 'Prova de Conceito - PGCOMP/UFBA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-900 text-gray-200">
        {children}
      </body>
    </html>
  );
}
