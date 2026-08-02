// Returns a public, simplified list of bookable rooms (id, name, price, capacity,
// thumbnail image) for use on the site's rooms/browsing pages. Exposes GET only.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { excludeUnderMaintenance } from '@/lib/room-availability';
import { dateKey, toDateOnly } from '@/lib/pricing';

// GET /api/rooms
// No parameters. Returns a JSON array of rooms that have a slug (are publicly
// listed) and aren't currently under maintenance, cheapest first, each with just
// the fields the frontend needs plus a single cover image.
export async function GET() {
  try {
    const today = toDateOnly(dateKey(new Date()));

    // Only include rooms that have a slug (i.e. are meant to be publicly listed)
    // and aren't flagged as under maintenance (excludeUnderMaintenance is a
    // shared Prisma "where" condition imported from lib/room-availability).
    const rooms = await prisma.room.findMany({
      where: { slug: { not: null }, ...excludeUnderMaintenance },
      include: { images: { orderBy: { order: 'asc' }, take: 1 }, dailyRates: { where: { date: today } } },
      orderBy: { price: 'asc' },
    });

    // Reshape the raw database rows into a smaller, frontend-friendly object —
    // hides internal fields and just picks the first (cover) image. `price`
    // stays the true LKR price (booking totals are computed from this,
    // untouched by display currency); `todayRates` carries any admin-set
    // overrides for today, used only to advertise a "from" price before
    // specific stay dates are picked (see app/api/rooms/pricing for the
    // real per-night lookup once dates are chosen).
    const shaped = rooms.map(r => ({
      id: r.slug,
      name: r.name,
      price: Number(r.price),
      todayRates: r.dailyRates.map(dr => ({ currency: dr.currency, market: dr.market, price: Number(dr.price) })),
      maxGuests: r.maxGuests,
      image: r.images[0]?.url ?? null,
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error('[GET /api/rooms]', error);
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 });
  }
}
