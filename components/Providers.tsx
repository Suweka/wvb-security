// Wraps the whole app with the context providers it needs everywhere:
// - ThemeProvider: shares light/dark theme state
// - SessionProvider (from next-auth): shares the logged-in user's session
// Used once, in app/layout.tsx, around {children}.
'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/components/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
