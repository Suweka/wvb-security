import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { currencyForCountry, marketForCountry } from '@/lib/currency'

const CURRENCY_COOKIE = 'nc_currency'
const MARKET_COOKIE = 'nc_market'

// Sets a currency + market cookie from the visitor's country on their first
// visit (via Vercel's free x-vercel-ip-country geo header). Never overwrites
// an existing cookie, so a manual pick (CurrencySwitcher / MarketSwitcher)
// always sticks and is never silently reverted by geo-detection later.
// These are two independent signals — see lib/currency.ts's Market comment
// for why market is never inferred from the (guest-switchable) currency.
export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country')
  const response = NextResponse.next()

  if (!request.cookies.has(CURRENCY_COOKIE)) {
    response.cookies.set(CURRENCY_COOKIE, currencyForCountry(country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  if (!request.cookies.has(MARKET_COOKIE)) {
    response.cookies.set(MARKET_COOKIE, marketForCountry(country), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
}
