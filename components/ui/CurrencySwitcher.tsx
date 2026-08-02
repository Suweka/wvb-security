// Small dropdown letting a visitor manually override the auto-detected
// display currency. The pick is persisted (see CurrencyProvider) so
// geo-detection never silently overwrites it again.
'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrency } from '@/components/CurrencyProvider';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

export function CurrencySwitcher({ className = '' }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Change display currency"
        title="Change display currency"
        className="flex items-center gap-1 h-10 px-3 rounded-full glass-card hover:scale-105 active:scale-95 transition-transform text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {currency}
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-32 glass-strong rounded-xl shadow-lg py-2 z-40">
            {SUPPORTED_CURRENCIES.map((code) => (
              <button
                key={code}
                onClick={() => {
                  setCurrency(code);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  code === currency
                    ? 'text-primary font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-light-green dark:hover:bg-white/10'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
