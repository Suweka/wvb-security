// Wraps the whole app with the context providers it needs everywhere:
// - ThemeProvider: shares light/dark theme state
// - CurrencyProvider: shares the visitor's active display currency
// - SessionProvider (from next-auth): shares the logged-in user's session
// Used once, in app/layout.tsx, around {children}.
'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CurrencyProvider } from '@/components/CurrencyProvider';

export function Providers({
  children,
  initialCurrency,
  initialMarket,
}: {
  children: React.ReactNode;
  initialCurrency: string;
  initialMarket: string;
}) {
  return (
    <ThemeProvider>
      <CurrencyProvider initialCurrency={initialCurrency} initialMarket={initialMarket}>
        <SessionProvider>{children}</SessionProvider>
      </CurrencyProvider>
    </ThemeProvider>
  );
}
