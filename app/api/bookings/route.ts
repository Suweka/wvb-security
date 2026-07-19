import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
// read/write rows in the PostgreSQL database from TypeScript code.
import { prisma } from '@/lib/prisma';
// Sends the "your bank transfer booking is pending" confirmation email.
import { sendBankTransferPendingEmail } from '@/lib/email';

// Builds a shuman-readable, roughly-unique booking reference like "WVB-2026-A1B2C3" (WVB = White Vintage Bungalow). 
export function generateBookingNumber(): string {
  const year = new Date().getFullYear();
  // Math.random() gives a decimal like 0.482991...
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WVB-${year}-${random}`;
}

// Looks up a Room in the database by its URL slug (e.g. "family-room").
async function resolveRoom(slug: string) {
  return prisma.room.findUnique({
    where: { slug },
    include: {
      // Rooms with an open MAINTENANCE task are treated as unbookable below.
      tasks: { where: { category: 'MAINTENANCE', status: { not: 'COMPLETED' } }, select: { id: true } },
    },
  });
}


export async function POST(request: NextRequest) {
  try {
    // same as writing `const rooms = body.rooms; const checkIn = body.checkIn; ...`.
    const body = await request.json();
    const { rooms, checkIn, checkOut, guests, guestDetails, paymentMethod, couponCode, totalAmount } = body;

    if (!rooms?.length || !checkIn || !checkOut || !guestDetails?.email) {
      return NextResponse.json({ error: 'Missing required booking fields.' }, { status: 400 });
    }

    // Link to logged-in user if a session exists
    // again — if there's no session, userId just ends up `null`.
    const session = await getServerSession(authOptions);
    const userId  = session?.user?.id || null;

    const resolvedRooms: NonNullable<Awaited<ReturnType<typeof resolveRoom>>>[] = [];
    const seenIds = new Set<string>(); // tracks room IDs we've already added, to avoid duplicate bookings for the same room
    const missingSlugs: string[] = [];      // slugs that don't match any room in the DB
    const maintenanceSlugs: string[] = [];  // slugs that exist but are currently under maintenance

    for (const slug of rooms as string[]) {
      const room = await resolveRoom(slug);
      if (!room) {
        // No room found for this slug at all — probably a stale link.
        missingSlugs.push(slug);
      } else if (room.tasks.length > 0) {
        // Room exists but has an open maintenance task — block the booking.
        maintenanceSlugs.push(slug);
      } else if (!seenIds.has(room.id)) {
        // Valid, bookable, and not a duplicate — keep it.
        resolvedRooms.push(room);
        seenIds.add(room.id);
      }
    }

    // If ANY selected room is under maintenance, reject the whole booking
    // (409 = "Conflict" — the request conflicts with the current state of
    // the server/database).
    if (maintenanceSlugs.length > 0) {
      return NextResponse.json(
        { error: `Room(s) currently under maintenance and unavailable to book: ${maintenanceSlugs.join(', ')}.` },
        { status: 409 }
      );
    }

    // If any slug didn't match a real room, reject too.
    if (missingSlugs.length > 0) {
      return NextResponse.json(
        { error: `Room(s) not found: ${missingSlugs.join(', ')}. Please refresh and try again.` },
        { status: 400 }
      );
    }

    if (resolvedRooms.length === 0) {
      return NextResponse.json({ error: 'No rooms selected. Please choose at least one room.' }, { status: 400 });
    }

    // Create GuestCheckout record
    const guestCheckout = await prisma.guestCheckout.create({
      data: {
        email:     guestDetails.email,
        firstName: guestDetails.firstName,
        lastName:  guestDetails.lastName,
        phone:     guestDetails.phone,
        country:   guestDetails.country || null,
      },
    });

    // Increment coupon usage if one was applied
    if (couponCode) {
      await prisma.coupon.updateMany({
        where: { code: couponCode, isActive: true },
        data:  { usageCount: { increment: 1 } },
      }).catch(() => {}); // non-fatal if coupon already expired
    }

    // Distribute totalAmount proportionally across rooms by their DB price
    // combined total nightly rate.
    const totalNightlyRate = resolvedRooms.reduce((sum, r) => sum + Number(r.price), 0);
    const baseBookingNumber = generateBookingNumber();

    // Create one Booking row per room, all in parallel with Promise.all
    const createdBookings = await Promise.all(
      resolvedRooms.map((room, index) => {
        // This room's fraction of the total price. If for some reason the
        // combined nightly rate is 0 (shouldn't happen), fall back to an
        // even split across however many rooms were booked.
        const share = totalNightlyRate > 0 ? Number(room.price) / totalNightlyRate : 1 / resolvedRooms.length;
        // Round to 2 decimal places (cents) after applying that share to
        // the overall total.
        const roomTotal = Math.round(Number(totalAmount) * share * 100) / 100;

        return prisma.booking.create({
          data: {
            // The first room keeps the "clean" booking number; any
            // additional rooms in the same checkout get a "-R2", "-R3"...
            // suffix so they're still grouped together but individually
            // identifiable.
            bookingNumber:   index === 0 ? baseBookingNumber : `${baseBookingNumber}-R${index + 1}`,
            guestCheckoutId: guestCheckout.id,
            userId:          userId,
            roomId:          room.id,
            checkIn:         new Date(checkIn),
            checkOut:        new Date(checkOut),
            guests:          Number(guests),
            totalAmount:     roomTotal,
            status:          'PENDING',       // booking isn't confirmed by staff yet
            paymentStatus:   'PENDING',       // payment hasn't been verified yet
            paymentMethod:   paymentMethod || null,
            specialRequests: guestDetails.specialRequests || null,
          },
        });
      })
    );

    // Send email for bank transfer — includes receipt upload link
    // Bank transfer payments can't be verified automatically like a card
    // payment, so we email the guest instructions plus a link to upload
    // their transfer receipt (handled by /booking/upload-receipt).
    if (paymentMethod === 'bank') {
      // Small local helper to format an ISO date string into something
      // readable like "Jul 19, 2026" for the email.
      const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      sendBankTransferPendingEmail({
        to:            guestDetails.email,
        guestName:     `${guestDetails.firstName} ${guestDetails.lastName}`,
        bookingNumber: baseBookingNumber,
        rooms:         resolvedRooms.map(r => r.name).join(', '),
        checkIn:       fmtDate(checkIn),
        checkOut:      fmtDate(checkOut),
        totalAmount:   Number(totalAmount),
      }).catch(err => console.error('[email] bank transfer email failed:', err));
    }

    // Success response — the frontend uses `bookingNumber` to show a
    // confirmation screen and `bookingIds` if it needs to reference the
    // individual database rows (e.g. for the receipt upload step).
    return NextResponse.json({
      success:       true,
      bookingNumber: baseBookingNumber,
      bookingIds:    createdBookings.map(b => b.id),
      roomCount:     resolvedRooms.length,
    });

  } catch (error) {
    // Catch-all for anything unexpected (DB connection issue, bad JSON,
    // etc). 500 = "Internal Server Error". We log the real error server-side
    // for debugging but only send a generic message to the browser.
    console.error('[POST /api/bookings]', error);
    return NextResponse.json({ error: 'Failed to create booking. Please try again.' }, { status: 500 });
  }
}
