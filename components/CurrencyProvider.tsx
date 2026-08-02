// Provides the visitor's active display currency to the whole app via React
// Context. The initial value is read server-side (see app/layout.tsx) from
// the 'nc_currency' cookie set by middleware.ts based on geo-IP country, so
// there's no client-side flash of the wrong currency on first paint. Manually
// switching currency (CurrencySwitcher) updates the same cookie so the pick
// persists and is never overwritten by geo-detection again.
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Currency, DEFAULT_CURRENCY, isSupportedCurrency, Market, isMarket } from '@/lib/currency';
import type { ExchangeRates } from '@/lib/pricing';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  // Admin-set LKR conversion rates (see /admin/pricing), used to
  // auto-convert a room's LKR price wherever no explicit per-date price
  // override exists for the active currency. Empty until the initial
  // fetch resolves; a currency with no configured rate is just absent.
  rates: ExchangeRates;
  // Local (Sri Lankan) vs. foreign guest pricing tier — deliberately
  // independent of `currency` (display choice) even though both are
  // geo-detected and both live in this same provider. See lib/currency.ts.
  market: Market;
  setMarket: (market: Market) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const CURRENCY_COOKIE = 'nc_currency';
const MARKET_COOKIE = 'nc_market';

export function CurrencyProvider({
  initialCurrency,
  initialMarket,
  children,
}: {
  initialCurrency: string;
  initialMarket: string;
  children: React.ReactNode;
}) {
  const [currency, setCurrencyState] = useState<Currency>(
    isSupportedCurrency(initialCurrency) ? initialCurrency : DEFAULT_CURRENCY
  );
  const [market, setMarketState] = useState<Market>(
    isMarket(initialMarket) ? initialMarket : 'FOREIGN'
  );
  const [rates, setRates] = useState<ExchangeRates>({});

  // Fetch the admin-set exchange rates once on mount. Public/no-auth
  // endpoint — same as any other published price on the site.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/exchange-rates')
      .then(r => r.json())
      .then((data: ExchangeRates) => { if (!cancelled) setRates(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const setCurrency = (next: Currency) => {
    setCurrencyState(next);
    document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  const setMarket = (next: Market) => {
    setMarketState(next);
    document.cookie = `${MARKET_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, market, setMarket }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
