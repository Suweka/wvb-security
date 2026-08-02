// Returns real per-night prices for a set of rooms across a specific stay
// (check-in inclusive, check-out exclusive — same convention as
// /api/rooms/availability), so the booking flow can compute an accurate
// total instead of assuming one flat nightly rate. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toDateOnly } from '@/lib/pricing';

// POST /api/rooms/pricing
// Expects JSON body { roomSlugs: string[], checkIn: "YYYY-MM-DD", checkOut: "YYYY-MM-DD" }.
// Returns each room's base price plus every RoomDailyRate row (any currency)
// falling within the stay, so the client can run the same resolveNightlyRate
// logic locally to build a full breakdown.
export async function POST(request: NextRequest) {
  try {
    const { roomSlugs, checkIn, checkOut } = await request.json();

    if (!roomSlugs?.length || !checkIn || !checkOut) {
      return NextResponse.json({ rooms: [] });
    }

    const rooms = await prisma.room.findMany({
      where: { slug: { in: roomSlugs as string[] } },
      select: {
        id: true,
        slug: true,
        price: true,
        dailyRates: {
          where: {
            date: {
              gte: toDateOnly(checkIn),
              lt: toDateOnly(checkOut),
            },
          },
        },
      },
    });

    return NextResponse.json({
      rooms: rooms.map(r => ({
        id: r.slug,
        price: Number(r.price),
        dailyRates: r.dailyRates.map(dr => ({
          date: dr.date.toISOString().slice(0, 10),
          currency: dr.currency,
          market: dr.market,
          price: Number(dr.price),
        })),
      })),
    });
  } catch (error) {
    console.error('[POST /api/rooms/pricing]', error);
    return NextResponse.json({ rooms: [] });
  }
}
