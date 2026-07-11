import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SLUG_TO_NAME: Record<string, string> = {
  'deluxe-room':   'Deluxe Room',
  'junior-suite':  'Junior Suite',
  'family-room':   'Family Room',
  'premium-suite': 'Premium Suite',
  'single-room':   'Single Room',
  'garden-view':   'Garden View Room',
};

export async function POST(request: NextRequest) {
  try {
    const { roomSlugs } = await request.json();

    if (!roomSlugs?.length) {
      return NextResponse.json({ unavailableDates: [] });
    }

    const roomNames = (roomSlugs as string[]).map(s => SLUG_TO_NAME[s] || s);

    const rooms = await prisma.room.findMany({
      where: { name: { in: roomNames, mode: 'insensitive' } },
      select: { id: true },
    });

    if (rooms.length === 0) {
      return NextResponse.json({ unavailableDates: [] });
    }

    const roomIds = rooms.map(r => r.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active bookings for these rooms from today onwards
    const bookings = await prisma.booking.findMany({
      where: {
        roomId:   { in: roomIds },
        status:   { not: 'CANCELLED' },
        checkOut: { gt: today },
      },
      select: { checkIn: true, checkOut: true },
    });

    // Expand each booking into individual dates (checkIn inclusive, checkOut exclusive)
    const unavailableSet = new Set<string>();

    const toLocalKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    for (const booking of bookings) {
      // Parse stored UTC midnight dates as local dates to match what the calendar renders
      const checkInStr  = booking.checkIn.toISOString().split('T')[0];
      const checkOutStr = booking.checkOut.toISOString().split('T')[0];
      const cur = new Date(checkInStr + 'T00:00:00');
      const end = new Date(checkOutStr + 'T00:00:00');
      while (cur < end) {
        unavailableSet.add(toLocalKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    return NextResponse.json({ unavailableDates: Array.from(unavailableSet) });

  } catch (error) {
    console.error('[POST /api/rooms/availability]', error);
    return NextResponse.json({ unavailableDates: [] });
  }
}
