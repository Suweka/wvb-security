// Returns which calendar dates are already booked for a given set of rooms, so the
// booking form's date picker can grey them out. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/rooms/availability
// Expects JSON body { roomSlugs: string[] }. Finds all non-cancelled bookings for
// those rooms from today onward, expands each booking's date range into individual
// calendar dates, and returns { unavailableDates: string[] } (as "YYYY-MM-DD" strings).
export async function POST(request: NextRequest) {
  try {
    const { roomSlugs } = await request.json();

    if (!roomSlugs?.length) {
      return NextResponse.json({ unavailableDates: [] });
    }

    // Turn the human-readable room slugs (from the URL) into internal room IDs.
    const rooms = await prisma.room.findMany({
      where: { slug: { in: roomSlugs as string[] } },
      select: { id: true },
    });

    if (rooms.length === 0) {
      return NextResponse.json({ unavailableDates: [] });
    }

    const roomIds = rooms.map(r => r.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active bookings for these rooms from today onwards
    // (excludes CANCELLED bookings and anything that already checked out).
    const bookings = await prisma.booking.findMany({
      where: {
        roomId:   { in: roomIds },
        status:   { not: 'CANCELLED' },
        checkOut: { gt: today },
      },
      select: { checkIn: true, checkOut: true },
    });

    // Expand each booking into individual dates (checkIn inclusive, checkOut exclusive)
    // e.g. a booking from the 5th to the 8th blocks the 5th, 6th, and 7th (guest
    // checks out on the 8th, so that date is free for the next guest to check in).
    const unavailableSet = new Set<string>();

    // Formats a Date as a plain "YYYY-MM-DD" string using its LOCAL date parts
    // (not UTC), so it lines up with how the calendar UI displays dates.
    const toLocalKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    for (const booking of bookings) {
      // Parse stored UTC midnight dates as local dates to match what the calendar renders
      const checkInStr  = booking.checkIn.toISOString().split('T')[0];
      const checkOutStr = booking.checkOut.toISOString().split('T')[0];
      const cur = new Date(checkInStr + 'T00:00:00');
      const end = new Date(checkOutStr + 'T00:00:00');
      // Walk day-by-day from check-in up to (but not including) check-out,
      // adding each date to the "unavailable" set.
      while (cur < end) {
        unavailableSet.add(toLocalKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    return NextResponse.json({ unavailableDates: Array.from(unavailableSet) });

  } catch (error) {
    console.error('[POST /api/rooms/availability]', error);
    // On error, fail "open" with an empty list rather than blocking the whole
    // booking form — better UX than crashing the date picker.
    return NextResponse.json({ unavailableDates: [] });
  }
}
