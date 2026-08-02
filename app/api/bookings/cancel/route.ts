// Self-service booking cancellation for logged-in guests, from their
// profile's My Bookings tab. Cancels the WHOLE reservation (a multi-room
// checkout is stored as sibling Booking rows sharing a bookingNumber
// prefix, but paid with ONE payment) and, if it was already paid,
// automatically files a RefundRequest with the policy-computed refundable
// amount (lib/refund-policy.ts) for an admin to process on
// /admin/reservations. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { logAudit, getClientIp } from '@/lib/audit-log';
import { calculateRefund } from '@/lib/refund-policy';
import { sendBookingCancelledEmail } from '@/lib/email';

// POST /api/bookings/cancel
// Expects JSON body { bookingNumber, reason? }. Requires a logged-in guest
// who owns the booking. Returns { success, refundRequested, refundAmount, rule }.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be logged in to cancel a booking.' }, { status: 401 });
    }

    const { bookingNumber, reason } = await request.json();
    if (!bookingNumber) {
      return NextResponse.json({ error: 'bookingNumber is required.' }, { status: 400 });
    }

    // Load the primary booking and any sibling room rows of the same
    // reservation (same lookup pattern as the PayHere checkout route).
    const allBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { bookingNumber },
          { bookingNumber: { startsWith: `${bookingNumber}-R` } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (allBookings.length === 0) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });
    }

    const primary = allBookings[0];

    // Guests can only cancel their own bookings — never someone else's.
    if (primary.userId !== session.user.id) {
      return NextResponse.json({ error: 'This booking does not belong to your account.' }, { status: 403 });
    }

    if (primary.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This booking is already cancelled.' }, { status: 400 });
    }
    if (primary.checkOut.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Past stays cannot be cancelled.' }, { status: 400 });
    }

    // Cancel every room row in the reservation.
    await prisma.booking.updateMany({
      where: { id: { in: allBookings.map(b => b.id) } },
      data: { status: 'CANCELLED' },
    });

    await logAudit({
      actor: session.user.email || session.user.id,
      action: 'BOOKING_CANCEL',
      entityType: 'Booking',
      entityId: primary.id,
      metadata: { bookingNumber, by: 'guest', ip: getClientIp(request) },
    });

    // If the reservation was paid, file a refund request with the
    // policy-computed amount over the reservation's COMBINED total (one
    // payment covers all sibling rooms).
    let refundRequested = false;
    let refundAmount = 0;
    let rule: string | null = null;

    if (primary.paymentStatus === 'PAID') {
      const combinedTotal = allBookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const refund = calculateRefund({
        totalAmount: combinedTotal,
        checkIn: primary.checkIn,
        checkOut: primary.checkOut,
        cancelledAt: new Date(),
      });

      await prisma.refundRequest.create({
        data: {
          bookingId: primary.id,
          reason: reason || null,
          amount: refund.amount,
          rule: refund.rule,
        },
      });

      refundRequested = true;
      refundAmount = refund.amount;
      rule = refund.rule;

      await logAudit({
        actor: session.user.email || session.user.id,
        action: 'REFUND_REQUESTED',
        entityType: 'Booking',
        entityId: primary.id,
        metadata: { bookingNumber, amount: refund.amount, rule: refund.rule, reason: reason || null },
      });
    }

    // Fire-and-forget confirmation email (Resend failures are swallowed by
    // sendEmail — the cancellation itself must never depend on delivery).
    if (session.user.email) {
      sendBookingCancelledEmail({
        to: session.user.email,
        guestName: session.user.name || 'Guest',
        bookingNumber,
        refundRequested,
        refundAmount,
        rule: rule ?? undefined,
      }).catch(err => console.error('[email] cancellation email failed:', err));
    }

    return NextResponse.json({ success: true, refundRequested, refundAmount, rule });
  } catch (error) {
    console.error('[POST /api/bookings/cancel]', error);
    return NextResponse.json({ error: 'Failed to cancel the booking. Please try again.' }, { status: 500 });
  }
}
