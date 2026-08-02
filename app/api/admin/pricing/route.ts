// Manages per-night price overrides (RoomDailyRate) for the admin pricing
// calendar at /admin/pricing. GET reads a month of overrides for one
// room+currency; POST upserts a date range (a single date is just a range
// of one); DELETE removes a date range's overrides, reverting those nights
// to the room's base Room.price.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';
import { SUPPORTED_CURRENCIES, isMarket, Market } from '@/lib/currency';
import { toDateOnly } from '@/lib/pricing';

// Walks every date from `start` to `end` (inclusive), returning "YYYY-MM-DD"
// local-date strings — used to expand a bulk-edit range into individual rows.
function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function isValidCurrency(value: unknown): value is string {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

// GET /api/admin/pricing?roomId=&currency=&market=&month=YYYY-MM
// Returns the room's base price plus every RoomDailyRate override for that
// currency+market falling within the given month. `market` defaults to
// LOCAL (foreign pricing is opt-in — see lib/pricing.ts's fallback).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    const currency = searchParams.get('currency');
    const month = searchParams.get('month'); // "YYYY-MM"
    const marketParam = searchParams.get('market');
    const market: Market = marketParam && isMarket(marketParam) ? marketParam : 'LOCAL';

    if (!roomId || !currency || !month || !isValidCurrency(currency)) {
      return NextResponse.json({ error: 'roomId, a valid currency, and month are required.' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { price: true } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    const [year, monthNum] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, monthNum - 1, 1));
    const to = new Date(Date.UTC(year, monthNum, 1)); // first day of the following month (exclusive upper bound)

    const rates = await prisma.roomDailyRate.findMany({
      where: { roomId, currency, market, date: { gte: from, lt: to } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      basePrice: Number(room.price),
      rates: rates.map(r => ({ date: r.date.toISOString().slice(0, 10), price: Number(r.price) })),
    });
  } catch (error) {
    console.error('Fetch pricing calendar error:', error);
    return NextResponse.json({ error: 'Failed to load pricing calendar.' }, { status: 500 });
  }
}

// POST /api/admin/pricing
// Expects { roomId, currency, market?, startDate, endDate, price } —
// upserts one RoomDailyRate row per date in the range. `market` defaults
// to LOCAL.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { roomId, currency, startDate, endDate, price, market: marketBody } = await req.json();
    const market: Market = marketBody && isMarket(marketBody) ? marketBody : 'LOCAL';

    if (!roomId || !isValidCurrency(currency) || !startDate || !endDate || price == null || Number(price) <= 0) {
      return NextResponse.json({ error: 'roomId, a valid currency, startDate, endDate, and a positive price are required.' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'endDate must not be before startDate.' }, { status: 400 });
    }

    const dates = datesInRange(startDate, endDate);
    await Promise.all(
      dates.map(date =>
        prisma.roomDailyRate.upsert({
          where: { roomId_date_currency_market: { roomId, date: toDateOnly(date), currency, market } },
          update: { price: Number(price) },
          create: { roomId, date: toDateOnly(date), currency, market, price: Number(price) },
        })
      )
    );

    await logAudit({
      actor: admin.email,
      action: 'ROOM_PRICING_SET',
      entityType: 'Room',
      entityId: roomId,
      metadata: { currency, market, startDate, endDate, price: Number(price), nights: dates.length },
    });

    return NextResponse.json({ success: true, nightsUpdated: dates.length });
  } catch (error) {
    console.error('Set pricing calendar error:', error);
    return NextResponse.json({ error: 'Failed to save pricing.' }, { status: 500 });
  }
}

// DELETE /api/admin/pricing
// Expects { roomId, currency, market?, startDate, endDate } — removes
// overrides in that range, reverting those nights to the room's base
// price (or, for FOREIGN, to the LOCAL rate). `market` defaults to LOCAL.
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { roomId, currency, startDate, endDate, market: marketBody } = await req.json();
    const market: Market = marketBody && isMarket(marketBody) ? marketBody : 'LOCAL';

    if (!roomId || !isValidCurrency(currency) || !startDate || !endDate) {
      return NextResponse.json({ error: 'roomId, a valid currency, startDate, and endDate are required.' }, { status: 400 });
    }

    const from = toDateOnly(startDate);
    const to = toDateOnly(endDate);

    const result = await prisma.roomDailyRate.deleteMany({
      where: { roomId, currency, market, date: { gte: from, lte: to } },
    });

    await logAudit({
      actor: admin.email,
      action: 'ROOM_PRICING_CLEAR',
      entityType: 'Room',
      entityId: roomId,
      metadata: { currency, market, startDate, endDate, nightsCleared: result.count },
    });

    return NextResponse.json({ success: true, nightsCleared: result.count });
  } catch (error) {
    console.error('Clear pricing calendar error:', error);
    return NextResponse.json({ error: 'Failed to clear pricing.' }, { status: 500 });
  }
}
