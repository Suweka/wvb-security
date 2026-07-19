// This route lets an admin cancel or edit an existing reservation
// (identified by its booking number in the URL). Only PATCH is exposed,
// and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// PATCH /api/admin/reservations/[id]
// `params.id` here is actually the booking's human-readable bookingNumber
// (not its database id). Expects { action: 'cancel' | 'edit', ... } in
// the JSON body:
//  - 'cancel': marks the booking CANCELLED.
//  - 'edit': expects { roomId, checkIn, checkOut, guests } and changes
//    the room/dates/guest count, after validating availability.
// Returns { success: true } or an error.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'cancel') {
      // Look up the booking by its public booking number.
      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

      // Flip its status to CANCELLED.
      await prisma.booking.update({
        where: { id: booking.id },
        data:  { status: 'CANCELLED' },
      });
      // Record the cancellation in the audit log.
      await logAudit({ actor: admin.email, action: 'BOOKING_CANCEL', entityType: 'Booking', entityId: booking.id, metadata: { bookingNumber: params.id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const { roomId, checkIn, checkOut, guests } = body;

      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

      // Validate the new dates are real dates and check-out is after check-in.
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
      }

      // Make sure the target room actually exists (and grab its price
      // for the total amount calculation below).
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

      // Availability check: look for any OTHER non-cancelled booking on
      // this room whose date range overlaps the requested new dates.
      // Two ranges overlap when one starts before the other ends, in
      // both directions (checkIn < otherCheckOut AND checkOut > otherCheckIn).
      const overlapping = await prisma.booking.findFirst({
        where: {
          id:       { not: booking.id },
          roomId,
          status:   { not: 'CANCELLED' },
          checkIn:  { lt: checkOutDate },
          checkOut: { gt: checkInDate },
        },
      });
      if (overlapping) {
        return NextResponse.json({ error: 'Room is not available for the selected dates.' }, { status: 409 });
      }

      // Recalculate the total price: nights stayed times the room's
      // nightly rate.
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = nights * Number(room.price);

      // Persist the edited room/dates/guest count/price on the booking.
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          roomId,
          checkIn:  checkInDate,
          checkOut: checkOutDate,
          guests:   Number(guests),
          totalAmount,
        },
      });
      // Record the edit in the audit log, including what changed.
      await logAudit({
        actor: admin.email,
        action: 'BOOKING_EDIT',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { bookingNumber: params.id, roomId, checkIn, checkOut, guests },
      });
      return NextResponse.json({ success: true });
    }

    // Neither 'cancel' nor 'edit' was provided.
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Update reservation error:', error);
    return NextResponse.json({ error: 'Failed to update reservation.' }, { status: 500 });
  }
}
