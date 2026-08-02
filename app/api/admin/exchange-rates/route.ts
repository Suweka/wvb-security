// Manages the admin-set LKR conversion rates used to auto-convert a room's
// LKR price into another currency wherever no explicit RoomDailyRate
// override exists for that date/currency (see lib/pricing.ts's
// convertFromLKR). GET lists all configured rates; PUT upserts one.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

// GET /api/admin/exchange-rates
// Returns every configured rate as { currency, rateToLKR, updatedAt }[].
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const rates = await prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } });
    return NextResponse.json(
      rates.map(r => ({ currency: r.currency, rateToLKR: Number(r.rateToLKR), updatedAt: r.updatedAt }))
    );
  } catch (error) {
    console.error('Fetch exchange rates error:', error);
    return NextResponse.json({ error: 'Failed to load exchange rates.' }, { status: 500 });
  }
}

// PUT /api/admin/exchange-rates
// Expects { currency, rateToLKR } — upserts a single currency's rate (e.g.
// "1 USD = 334.50 LKR" is { currency: 'USD', rateToLKR: 334.50 }).
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { currency, rateToLKR } = await req.json();

    if (
      typeof currency !== 'string' ||
      currency === 'LKR' ||
      !(SUPPORTED_CURRENCIES as readonly string[]).includes(currency) ||
      rateToLKR == null ||
      Number(rateToLKR) <= 0
    ) {
      return NextResponse.json({ error: 'A valid non-LKR currency and a positive rateToLKR are required.' }, { status: 400 });
    }

    const rate = await prisma.exchangeRate.upsert({
      where: { currency },
      update: { rateToLKR: Number(rateToLKR) },
      create: { currency, rateToLKR: Number(rateToLKR) },
    });

    await logAudit({
      actor: admin.email,
      action: 'EXCHANGE_RATE_SET',
      entityType: 'ExchangeRate',
      entityId: currency,
      metadata: { currency, rateToLKR: Number(rateToLKR) },
    });

    return NextResponse.json({ currency: rate.currency, rateToLKR: Number(rate.rateToLKR), updatedAt: rate.updatedAt });
  } catch (error) {
    console.error('Set exchange rate error:', error);
    return NextResponse.json({ error: 'Failed to save exchange rate.' }, { status: 500 });
  }
}
