// Lets a visitor manually declare whether they're a local (Sri Lankan) or
// foreign guest, overriding the geo-IP guess from middleware.ts. The pick is
// persisted (see CurrencyProvider) so geo-detection never overwrites it
// again. Deliberately a separate control from CurrencySwitcher — market
// decides which underlying price applies, currency only how it's displayed.
'use client';

import React from 'react';
import { useCurrency } from '@/components/CurrencyProvider';

export function MarketSwitcher({ className = '' }: { className?: string }) {
  const { market, setMarket } = useCurrency();

  return (
    <div
      className={`flex items-center h-10 rounded-full glass-card p-1 text-sm font-medium ${className}`}
      role="group"
      aria-label="Local or foreign guest pricing"
    >
      {(['LOCAL', 'FOREIGN'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setMarket(option)}
          title={option === 'LOCAL' ? 'Show local (Sri Lankan) pricing' : 'Show foreign guest pricing'}
          className={`px-3 h-8 rounded-full transition-colors ${
            market === option
              ? 'bg-primary text-white'
              : 'text-gray-700 dark:text-gray-300 hover:text-primary'
          }`}
        >
          {option === 'LOCAL' ? 'Local' : 'Foreign'}
        </button>
      ))}
    </div>
  );
}
