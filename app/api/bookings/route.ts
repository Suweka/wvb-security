import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
// read/write rows in the PostgreSQL database from TypeScript code.
import { prisma } from '@/lib/prisma';
// Sends the "your bank transfer booking is pending" confirmation email.
import { sendBankTransferPendingEmail } from '@/lib/email';
import { resolveNightlyRate, dateKey, toDateOnly } from '@/lib/pricing';
import { isMarket, type Market } from '@/lib/currency';

// Builds a shuman-readable, roughly-unique booking reference like "WVB-2026-A1B2C3" (WVB = White Vintage Bungalow).
export function generateBookingNumber(): string {
  const year = new Date().getFullYear();
  // Math.random() gives a decimal like 0.482991...
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `WVB-${year}-${random}`;
}

// Looks up a Room in the database by its URL slug (e.g. "family-room"),
// including its LKR daily-rate overrides for the requested stay so the
// real per-night price can be recomputed server-side rather than trusted
// from the client. Deliberately not filtered by market here — both LOCAL
// and FOREIGN LKR rows come back, and resolveNightlyRate below picks the
// right one (with its FOREIGN -> LOCAL fallback) for the actual guest.
async function resolveRoom(slug: string, checkInDate: Date, checkOutDate: Date) {
  return prisma.room.findUnique({
    where: { slug },
    include: {
      // Rooms with an open MAINTENANCE task are treated as unbookable below.
      tasks: { where: { category: 'MAINTENANCE', status: { not: 'COMPLETED' } }, select: { id: true } },
      dailyRates: { where: { currency: 'LKR', date: { gte: checkInDate, lt: checkOutDate } } },
    },
  });
}

// Every night (as "YYYY-MM-DD" keys) from checkIn (inclusive) to checkOut
// (exclusive) — same convention used everywhere else (availability, admin
// pricing, the booking flow's own toKey).
function nightKeysInRange(checkInDate: Date, checkOutDate: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(checkInDate);
  while (cur < checkOutDate) {
    keys.push(dateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export async function POST(request: NextRequest) {
  try {
    // same as writing `const rooms = body.rooms; const checkIn = body.checkIn; ...`.
    // `totalAmount` sent by the client is intentionally NOT trusted — the real
    // charge is recomputed below from each room's actual per-night rates.
    const body = await request.json();
    const { rooms, checkIn, checkOut, guests, guestDetails, paymentMethod, couponCode } = body;

    if (!rooms?.length || !checkIn || !checkOut || !guestDetails?.email) {
      return NextResponse.json({ error: 'Missing required booking fields.' }, { status: 400 });
    }

    const checkInDate = toDateOnly(checkIn);
    const checkOutDate = toDateOnly(checkOut);
    const nightKeys = nightKeysInRange(checkInDate, checkOutDate);

    // Which price tier actually applies is read from the same cookie that
    // drove what the guest was shown while browsing (nc_market, set by
    // middleware.ts / MarketSwitcher) — never from the request body, so a
    // booking is always charged what the guest was actually quoted rather
    // than whatever a client claims. Missing entirely (e.g. an old/direct
    // API caller) defaults to LOCAL, the cheaper tier — never silently
    // overcharge due to an absent signal.
    const marketCookie = request.cookies.get('nc_market')?.value;
    const market: Market = marketCookie && isMarket(marketCookie) ? marketCookie : 'LOCAL';

    // Link to logged-in user if a session exists
    // again — if there's no session, userId just ends up `null`.
    const session = await getServerSession(authOptions);
    const userId  = session?.user?.id || null;

    const resolvedRooms: NonNullable<Awaited<ReturnType<typeof resolveRoom>>>[] = [];
    const seenIds = new Set<string>(); // tracks room IDs we've already added, to avoid duplicate bookings for the same room
    const missingSlugs: string[] = [];      // slugs that don't match any room in the DB
    const maintenanceSlugs: string[] = [];  // slugs that exist but are currently under maintenance

    for (const slug of rooms as string[]) {
      const room = await resolveRoom(slug, checkInDate, checkOutDate);
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

    // Look up the coupon's real discount percentage from the DB (never
    // trusted from the client) and bump its usage count in the same step.
    // Only the simple isActive check is applied here — full re-validation
    // (date window, usage limit) already happens in /api/coupons/validate
    // before the guest reaches this step; re-checking that here is a
    // separate, larger effort left for later.
    let discountPercent = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (coupon?.isActive) {
        discountPercent = coupon.discountPercent;
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        }).catch(() => {}); // non-fatal if this races with something else
      }
    }

    // Recompute the REAL LKR subtotal from each room's actual per-night
    // rate (an admin-set RoomDailyRate override where one exists, else the
    // room's base price) — this is now the authoritative room cost,
    // replacing the flat Room.price assumption and the client-sent total.
    const roomSubtotals = resolvedRooms.map(room =>
      nightKeys.reduce((sum, night) => sum + resolveNightlyRate(room, night, 'LKR', market).amount, 0)
    );
    const subtotal = roomSubtotals.reduce((sum, s) => sum + s, 0);
    const discount = (subtotal * discountPercent) / 100;
    const tax = (subtotal - discount) * 0.1; // flat 10% tax, same as the booking flow's own display math
    const total = subtotal - discount + tax;

    const baseBookingNumber = generateBookingNumber();

    // Create one Booking row per room, all in parallel with Promise.all
    const createdBookings = await Promise.all(
      resolvedRooms.map((room, index) => {
        // This room's fraction of the real total, weighted by its own real
        // per-night subtotal (not a flat Room.price share).
        const share = subtotal > 0 ? roomSubtotals[index] / subtotal : 1 / resolvedRooms.length;
        // Round to 2 decimal places (cents) after applying that share to
        // the overall total.
        const roomTotal = Math.round(total * share * 100) / 100;

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
            checkIn:         checkInDate,
            checkOut:        checkOutDate,
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
        totalAmount:   total,
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
