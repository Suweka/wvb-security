// Public read-only endpoint returning the admin-set LKR conversion rates,
// used client-side (see CurrencyProvider) to auto-convert a room's LKR
// price into the visitor's active display currency wherever no explicit
// per-date price override exists. No auth — this is just published rates,
// same as any other price shown on the site.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/exchange-rates
// Returns { [currency]: rateToLKR } for every currency the admin has
// configured, e.g. { USD: 334.5, GBP: 420.1 }. A currency with no
// configured rate is simply absent — callers should fall back to LKR.
export async function GET() {
  try {
    const rates = await prisma.exchangeRate.findMany();
    const shaped: Record<string, number> = {};
    for (const r of rates) shaped[r.currency] = Number(r.rateToLKR);
    return NextResponse.json(shaped);
  } catch (error) {
    console.error('[GET /api/exchange-rates]', error);
    return NextResponse.json({});
  }
}
