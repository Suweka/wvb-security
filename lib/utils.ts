// Small collection of generic formatting/helper functions shared across the app.

// Formats a number as a currency string, e.g. formatCurrency(1500) -> "LKR 1,500".
// LKR (Sri Lankan Rupee) is handled manually since Intl's built-in currency
// formatter doesn't print the "LKR" symbol the way we want; any other currency
// code falls back to the standard Intl.NumberFormat currency formatting.
export function formatCurrency(amount: number, currency: string = 'LKR'): string {
  if (currency === 'LKR') {
    return `LKR ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// "cn" = "class names". Joins a list of Tailwind class strings into one space
// separated string, automatically dropping any falsy values (false/undefined/null)
// so you can write conditional classes like cn('a', isActive && 'b') safely.
export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// Formats a Date (or date string) as e.g. "January 5, 2026" for display.
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date // accept either a Date object or a date string
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}