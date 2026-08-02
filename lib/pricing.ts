// Per-night price resolution for rooms. A room's real price is Room.price
// (LKR, the fallback/base rate) unless an admin has set an explicit
// RoomDailyRate override for that specific date (and, optionally, a
// specific display currency) — see /admin/pricing. When no override exists
// for a non-LKR currency, the LKR price is auto-converted using an
// admin-set static rate (see /admin/pricing's Exchange Rates panel) rather
// than just being shown labeled as LKR.
//
// Every resolver also takes a `market` ('LOCAL' | 'FOREIGN', see
// lib/currency.ts). FOREIGN tries a foreign-specific override first (exact
// currency, then LKR-converted), and if neither exists for that date, falls
// straight through to the LOCAL resolution — foreign pricing is opt-in per
// date, never a separate base rate.

import type { Market } from './currency';

// "YYYY-MM-DD" from a Date's LOCAL parts (not UTC) — matches the convention
// already used by app/api/rooms/availability/route.ts's toLocalKey and the
// booking page's toKey, so date keys line up consistently across the app.
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// The inverse of dateKey — turns a "YYYY-MM-DD" string into a date-only
// Date object suitable for writing/querying a @db.Date column. Built with
// Date.UTC (not the local-time constructor) so the resulting calendar date
// is correct regardless of the server's local timezone — @db.Date values
// are timezone-agnostic, and Prisma normalizes them via their UTC
// representation, so constructing via local time would shift the stored
// date by the server's UTC offset (a real bug on any non-UTC machine,
// e.g. local dev in Sri Lanka, UTC+5:30).
export function toDateOnly(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

// Map of currency code -> how many LKR equal 1 unit of that currency (e.g.
// { USD: 334.5 } means 1 USD = 334.50 LKR), as configured by the admin.
export type ExchangeRates = Record<string, number>

// Converts an LKR amount into another currency using an admin-set static
// rate. Returns null (not 0) when no rate is configured, so callers can
// fall back to showing the LKR price instead of silently returning $0.
function convertFromLKR(amountLKR: number, currency: string, rates: ExchangeRates): number | null {
  const rate = rates[currency]
  if (!rate) return null
  return Math.round((amountLKR / rate) * 100) / 100
}

type DailyRateRow = { date: Date | string; currency: string; market?: string; price: number | { toString(): string } }
type PriceableRoom = { price: number | { toString(): string }; dailyRates?: DailyRateRow[] }

// Extracts a "YYYY-MM-DD" key from a RoomDailyRate row's date. String dates
// (already JSON-serialized via .toISOString().slice(0, 10), e.g. from
// /api/rooms/pricing) are used as-is. Real Date objects (from Prisma
// directly, e.g. in a server-side route) use UTC getters — matching how
// toDateOnly wrote them — NOT dateKey's local getters, which would be
// wrong here for the same server-timezone reason described above.
function rowDateKey(row: DailyRateRow): string {
  if (typeof row.date === 'string') return row.date.slice(0, 10)
  const d = row.date
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Resolves the price for one specific night in a target currency and
// market. Priority: an explicit (date, currency, market) override -> the
// LKR price for that night (an explicit (date, 'LKR', market) override,
// else Room.price) auto-converted into the target currency via the admin's
// exchange rate -> if no rate is configured either, the raw LKR price
// (correctly labeled 'LKR', never mislabeled as the requested currency).
// FOREIGN additionally falls all the way through to the LOCAL resolution
// whenever no foreign-specific row exists for that date.
export function resolveNightlyRate(
  room: PriceableRoom,
  night: string,
  currency: string,
  market: Market = 'LOCAL',
  rates: ExchangeRates = {}
): { currency: string; amount: number } {
  if (market === 'FOREIGN') {
    const exactForeign = room.dailyRates?.find(
      (r) => r.currency === currency && (r.market ?? 'LOCAL') === 'FOREIGN' && rowDateKey(r) === night
    )
    if (exactForeign) return { currency, amount: Number(exactForeign.price) }

    const lkrForeign = room.dailyRates?.find(
      (r) => r.currency === 'LKR' && (r.market ?? 'LOCAL') === 'FOREIGN' && rowDateKey(r) === night
    )
    if (lkrForeign) {
      const baseLKR = Number(lkrForeign.price)
      if (currency !== 'LKR') {
        const converted = convertFromLKR(baseLKR, currency, rates)
        if (converted != null) return { currency, amount: converted }
      }
      return { currency: 'LKR', amount: baseLKR }
    }

    // No foreign-specific pricing set for this date — silently fall back
    // to whatever the local guest would pay.
    return resolveNightlyRate(room, night, currency, 'LOCAL', rates)
  }

  const exact = room.dailyRates?.find(
    (r) => r.currency === currency && (r.market ?? 'LOCAL') === 'LOCAL' && rowDateKey(r) === night
  )
  if (exact) return { currency, amount: Number(exact.price) }

  const lkrOverride = room.dailyRates?.find(
    (r) => r.currency === 'LKR' && (r.market ?? 'LOCAL') === 'LOCAL' && rowDateKey(r) === night
  )
  const baseLKR = lkrOverride ? Number(lkrOverride.price) : Number(room.price)

  if (currency !== 'LKR') {
    const converted = convertFromLKR(baseLKR, currency, rates)
    if (converted != null) return { currency, amount: converted }
  }

  return { currency: 'LKR', amount: baseLKR }
}

type TodayRateRow = { currency: string; market?: string; price: number | { toString(): string } }
type AdvertisableRoom = { price: number | { toString(): string }; todayRates?: TodayRateRow[] }

// The price to advertise where no specific stay dates are picked yet (room
// grid/detail "from" price). `todayRates` is expected to already be
// pre-filtered to today's date by the caller's query (see the room list/
// detail pages). Same priority as resolveNightlyRate (including the
// FOREIGN -> LOCAL fallback): explicit rate for today in the requested
// currency/market -> today's LKR price auto-converted -> the raw LKR price.
export function resolveAdvertisedRate(
  room: AdvertisableRoom,
  currency: string,
  market: Market = 'LOCAL',
  rates: ExchangeRates = {}
): { currency: string; amount: number } {
  if (market === 'FOREIGN') {
    const matchForeign = room.todayRates?.find((r) => r.currency === currency && (r.market ?? 'LOCAL') === 'FOREIGN')
    if (matchForeign) return { currency, amount: Number(matchForeign.price) }

    const lkrForeign = room.todayRates?.find((r) => r.currency === 'LKR' && (r.market ?? 'LOCAL') === 'FOREIGN')
    if (lkrForeign) {
      const baseLKR = Number(lkrForeign.price)
      if (currency !== 'LKR') {
        const converted = convertFromLKR(baseLKR, currency, rates)
        if (converted != null) return { currency, amount: converted }
      }
      return { currency: 'LKR', amount: baseLKR }
    }

    return resolveAdvertisedRate(room, currency, 'LOCAL', rates)
  }

  const match = room.todayRates?.find((r) => r.currency === currency && (r.market ?? 'LOCAL') === 'LOCAL')
  if (match) return { currency, amount: Number(match.price) }

  const lkrToday = room.todayRates?.find((r) => r.currency === 'LKR' && (r.market ?? 'LOCAL') === 'LOCAL')
  const baseLKR = lkrToday ? Number(lkrToday.price) : Number(room.price)

  if (currency !== 'LKR') {
    const converted = convertFromLKR(baseLKR, currency, rates)
    if (converted != null) return { currency, amount: converted }
  }

  return { currency: 'LKR', amount: baseLKR }
}

// Sums the per-night rate for a set of rooms across a set of nights, for a
// target display currency. Every room/night can always be expressed in the
// target currency once an exchange rate is configured (auto-conversion is
// universal, not per-room), so the whole total consistently uses the
// target currency if a rate exists, or LKR if it doesn't — never a mix.
export function resolveStayTotal(
  rooms: PriceableRoom[],
  nights: string[],
  currency: string,
  market: Market = 'LOCAL',
  rates: ExchangeRates = {}
): { currency: string; nights: number; subtotal: number } {
  const effective = currency === 'LKR' || rates[currency] != null ? currency : 'LKR'
  const subtotal = rooms.reduce(
    (roomSum, room) => roomSum + nights.reduce((nightSum, n) => nightSum + resolveNightlyRate(room, n, effective, market, rates).amount, 0),
    0
  )

  return { currency: effective, nights: nights.length, subtotal }
}
