// This route lets an admin cancel, edit, or refund an existing reservation
// (identified by its booking number in the URL). Only PATCH is exposed,
// and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';
import { refundPayHerePayment } from '@/lib/payhere-refund';
import { sendRefundProcessedEmail } from '@/lib/email';

// PATCH /api/admin/reservations/[id]
// `params.id` here is actually the booking's human-readable bookingNumber
// (not its database id). Expects { action: 'cancel' | 'edit' | 'refund', ... }
// in the JSON body:
//  - 'cancel': marks the booking CANCELLED.
//  - 'edit': expects { roomId, checkIn, checkOut, guests } and changes
//    the room/dates/guest count, after validating availability.
//  - 'refund': expects { reason? } and, for an already-cancelled booking
//    paid via PayHere, calls PayHere's Refund API for the full amount.
// Returns { success: true } or an error.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
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

    if (action === 'refund') {
      const { reason, amount } = body;

      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
        include: { payment: true, refundRequest: true, user: true, guestCheckout: true },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

      // Refund is a deliberate follow-up to cancelling, not a substitute
      // for it — this also guards against refunding a still-active booking.
      if (booking.status !== 'CANCELLED') {
        return NextResponse.json({ error: 'Cancel the booking before refunding it.' }, { status: 400 });
      }
      if (booking.paymentStatus !== 'PAID') {
        return NextResponse.json({ error: 'This booking has no paid payment to refund.' }, { status: 400 });
      }

      // Optional partial amount (e.g. the policy-computed figure from a
      // guest's refund request, possibly edited by the admin). Missing/0
      // means a full refund.
      const refundAmount = amount != null && Number(amount) > 0 ? Number(amount) : undefined;

      if (booking.payment?.payhereId) {
        // Online (PayHere) payment — refund through the Refund API.
        const fullAmount = Number(booking.payment.amount);
        const result = await refundPayHerePayment({
          paymentId: booking.payment.payhereId,
          reason: reason || 'Guest cancellation',
          // Only send `amount` when it's genuinely partial — sending the
          // full figure as a "partial" refund is equivalent but noisier.
          amount: refundAmount != null && refundAmount < fullAmount ? refundAmount : undefined,
        });

        if (!result.ok) {
          await logAudit({
            actor: admin.email,
            action: 'PAYMENT_REFUND_FAILED',
            entityType: 'Payment',
            entityId: booking.payment.id,
            metadata: { bookingNumber: params.id, reason: result.message },
          });
          return NextResponse.json({ error: result.message }, { status: 502 });
        }

        await prisma.payment.update({
          where: { id: booking.payment.id },
          data:  { status: 'REFUNDED', refundedAt: new Date() },
        });
        await logAudit({
          actor: admin.email,
          action: 'PAYMENT_REFUND',
          entityType: 'Payment',
          entityId: booking.payment.id,
          metadata: { bookingNumber: params.id, amount: refundAmount ?? fullAmount, reason: reason || 'Guest cancellation', payhereRefundId: result.refundId },
        });
      } else {
        // Bank-transfer (or pre-refund-era) payment — no PayHere reference
        // to call, so the money goes back by a manual bank transfer done
        // outside the system; here we just record that it happened.
        await prisma.booking.updateMany({
          where: {
            OR: [
              { bookingNumber: params.id },
              { bookingNumber: { startsWith: `${params.id}-R` } },
            ],
          },
          data: { paymentStatus: 'REFUNDED' },
        });
        if (booking.payment) {
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data:  { status: 'REFUNDED', refundedAt: new Date() },
          });
        }
        await logAudit({
          actor: admin.email,
          action: 'PAYMENT_REFUND_MANUAL',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: { bookingNumber: params.id, amount: refundAmount ?? Number(booking.totalAmount), reason: reason || 'Guest cancellation', method: 'bank-transfer' },
        });
      }

      // If the guest had filed a refund request, mark it processed.
      if (booking.refundRequest) {
        await prisma.refundRequest.update({
          where: { id: booking.refundRequest.id },
          data: {
            status: 'APPROVED',
            processedAt: new Date(),
            processedBy: admin.email,
            ...(refundAmount != null ? { amount: refundAmount } : {}),
          },
        });
      }

      // Let the guest know their refund is on its way (fire-and-forget).
      const guestEmail = booking.user?.email || booking.guestCheckout?.email;
      const guestName = booking.user?.name || `${booking.guestCheckout?.firstName ?? ''} ${booking.guestCheckout?.lastName ?? ''}`.trim() || 'Guest';
      if (guestEmail) {
        sendRefundProcessedEmail({
          to: guestEmail,
          guestName,
          bookingNumber: params.id,
          amount: refundAmount ?? Number(booking.payment?.amount ?? booking.totalAmount),
          approved: true,
        }).catch(err => console.error('[email] refund email failed:', err));
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'reject-refund') {
      const { adminNote } = body;

      const booking = await prisma.booking.findFirst({
        where: { bookingNumber: params.id },
        include: { refundRequest: true, user: true, guestCheckout: true },
      });
      if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
      if (!booking.refundRequest || booking.refundRequest.status !== 'PENDING') {
        return NextResponse.json({ error: 'This booking has no pending refund request.' }, { status: 400 });
      }

      await prisma.refundRequest.update({
        where: { id: booking.refundRequest.id },
        data: {
          status: 'REJECTED',
          processedAt: new Date(),
          processedBy: admin.email,
          adminNote: adminNote || null,
        },
      });
      await logAudit({
        actor: admin.email,
        action: 'REFUND_REQUEST_REJECTED',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: { bookingNumber: params.id, adminNote: adminNote || null },
      });

      const guestEmail = booking.user?.email || booking.guestCheckout?.email;
      const guestName = booking.user?.name || `${booking.guestCheckout?.firstName ?? ''} ${booking.guestCheckout?.lastName ?? ''}`.trim() || 'Guest';
      if (guestEmail) {
        sendRefundProcessedEmail({
          to: guestEmail,
          guestName,
          bookingNumber: params.id,
          amount: Number(booking.refundRequest.amount),
          approved: false,
          adminNote: adminNote || undefined,
        }).catch(err => console.error('[email] refund rejection email failed:', err));
      }

      return NextResponse.json({ success: true });
    }

    // No recognized action ('cancel', 'edit', 'refund', 'reject-refund') was provided.
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Update reservation error:', error);
    return NextResponse.json({ error: 'Failed to update reservation.' }, { status: 500 });
  }
}
