import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'cancel') {
      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

      await prisma.booking.update({
        where: { id: booking.id },
        data:  { status: 'CANCELLED' },
      });
      await logAudit({ actor: admin.email, action: 'BOOKING_CANCEL', entityType: 'Booking', entityId: booking.id, metadata: { bookingNumber: params.id } });
      return NextResponse.json({ success: true });
    }

    if (action === 'edit') {
      const { roomId, checkIn, checkOut, guests } = body;

      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
        return NextResponse.json({ error: 'Invalid date range.' }, { status: 400 });
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

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

      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = nights * Number(room.price);

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
      await logAudit({
        actor: admin.email,
        action: 'BOOKING_EDIT',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { bookingNumber: params.id, roomId, checkIn, checkOut, guests },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Update reservation error:', error);
    return NextResponse.json({ error: 'Failed to update reservation.' }, { status: 500 });
  }
}
