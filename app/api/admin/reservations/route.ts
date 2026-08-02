// Lets an admin manually log a reservation that came in through a channel
// other than the website — a phone call, a WhatsApp message, or a guest
// who walked in and booked in person. Only POST is exposed, and only
// admins can call it. See app/api/admin/reservations/[id]/route.ts for
// editing/cancelling an existing reservation.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';
import { generateBookingNumber } from '@/app/api/bookings/route';

// Only these three sources make sense for a *manually logged* booking —
// bookings actually made through the website already get created (with
// source: WEBSITE) by app/api/bookings/route.ts, so that value is
// deliberately not accepted here.
const MANUAL_SOURCES = ['PHONE', 'WHATSAPP', 'WALK_IN'] as const;

// POST /api/admin/reservations
// Expects { source, roomId, checkIn, checkOut, guests, firstName, lastName,
// phone, email?, specialRequests?, paymentStatus? } in the JSON body.
// Creates a GuestCheckout + a CONFIRMED Booking (the admin is recording a
// reservation they've already accepted, not a pending online request),
// after checking the room exists and isn't already booked for those dates.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const {
      source, roomId, checkIn, checkOut, guests,
      firstName, lastName, phone, email, specialRequests, paymentStatus,
    } = await request.json();

    if (!MANUAL_SOURCES.includes(source)) {
      return NextResponse.json({ error: 'Source must be one of: phone, whatsapp, walk-in.' }, { status: 400 });
    }
    if (!roomId || !checkIn || !checkOut || !guests || !firstName?.trim() || !lastName?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Room, dates, guest count, name, and phone are all required.' }, { status: 400 });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    // Same overlap check used when editing a reservation: any OTHER
    // non-cancelled booking on this room whose range overlaps the requested dates.
    const overlapping = await prisma.booking.findFirst({
      where: {
        roomId,
        status:   { not: 'CANCELLED' },
        checkIn:  { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });
    if (overlapping) {
      return NextResponse.json({ error: 'Room is not available for the selected dates.' }, { status: 409 });
    }

    // GuestCheckout.email is required in the schema, but a phone/WhatsApp/
    // walk-in guest won't always have given one — fall back to a clearly
    // synthetic placeholder rather than blocking the booking on it.
    const guestEmail = email?.trim() || `walkin+${Date.now()}@no-email.internal`;

    const guestCheckout = await prisma.guestCheckout.create({
      data: {
        email: guestEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      },
    });

    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = nights * Number(room.price);
    const bookingNumber = generateBookingNumber();

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        guestCheckoutId: guestCheckout.id,
        roomId,
        checkIn:  checkInDate,
        checkOut: checkOutDate,
        guests:   Number(guests),
        totalAmount,
        // The admin is recording a reservation they've already agreed to
        // with the guest, not a pending online request — so it's created
        // straight into CONFIRMED, rather than PENDING like the website flow.
        status:        'CONFIRMED',
        paymentStatus: paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
        paymentMethod: source === 'WALK_IN' ? 'cash' : null,
        specialRequests: specialRequests || null,
        source,
      },
    });

    await logAudit({
      actor: admin.email,
      action: 'BOOKING_CREATE_MANUAL',
      entityType: 'Booking',
      entityId: booking.id,
      metadata: { bookingNumber, source, roomId, checkIn, checkOut },
    });

    return NextResponse.json({ success: true, booking: { id: booking.id, bookingNumber } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/reservations]', error);
    return NextResponse.json({ error: 'Failed to create reservation.' }, { status: 500 });
  }
}
