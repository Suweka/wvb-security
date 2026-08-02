// Detects which currency to show a visitor based on their country (from a
// geo-IP header, see middleware.ts). Actual per-room/per-night price
// resolution lives in lib/pricing.ts.

export const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'GBP', 'EUR', 'AUD'] as const
export type Currency = (typeof SUPPORTED_CURRENCIES)[number]

// Currency shown when a visitor's country isn't in the map below, or when
// no geo header is available at all (e.g. local dev). Matches common OTA
// practice of defaulting unrecognized visitors to USD rather than LKR.
export const DEFAULT_CURRENCY: Currency = 'USD'

const EUROZONE_COUNTRIES = [
  'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR',
]

const COUNTRY_CURRENCY: Record<string, Currency> = {
  LK: 'LKR',
  US: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  NZ: 'AUD',
  ...Object.fromEntries(EUROZONE_COUNTRIES.map((code) => [code, 'EUR' as Currency])),
}

export function currencyForCountry(countryCode?: string | null): Currency {
  if (!countryCode) return DEFAULT_CURRENCY
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY
}

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

// Local (Sri Lankan) vs. foreign guest pricing tier — see lib/pricing.ts and
// /admin/pricing. Deliberately separate from currency: currency is a
// guest-switchable *display* choice, market is "which underlying price
// applies" and must never be inferred from the display currency (a local
// guest browsing in USD, or a tourist browsing in LKR, must still get their
// correct market's price).
export const MARKETS = ['LOCAL', 'FOREIGN'] as const
export type Market = (typeof MARKETS)[number]

export function marketForCountry(countryCode?: string | null): Market {
  if (!countryCode) return 'FOREIGN'
  return countryCode.toUpperCase() === 'LK' ? 'LOCAL' : 'FOREIGN'
}

export function isMarket(value: string): value is Market {
  return (MARKETS as readonly string[]).includes(value)
}
