// This route lets an admin approve or reject a bank-transfer payment
// receipt uploaded by a guest. Approving confirms the booking and sends
// a confirmation email; rejecting cancels it. Only PATCH is exposed, and
// only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingConfirmedEmail } from '@/lib/email';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// PATCH /api/admin/receipts/[id]
// Expects { action: 'approve' | 'reject' } in the JSON body. Updates the
// receipt's status, updates the related booking(s) status/payment
// status, logs the action to the audit log, and (on approval) emails the
// guest a confirmation. Returns { success, status }.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // requireAdmin returns the admin's info (e.g. email) when authorized,
  // or a falsy value when not — used both as a guard and to know who
  // performed this action for the audit log.
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { action } = await request.json(); // 'approve' | 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject".' }, { status: 400 });
    }

    // Load the receipt plus its booking, and the booking's guest and
    // room details, since we need all of that to send a confirmation
    // email later.
    const receipt = await prisma.bankTransferReceipt.findUnique({
      where:   { id: params.id },
      include: {
        booking: {
          include: { guestCheckout: true, room: true },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
    }

    // Decide the new statuses based on which action the admin chose.
    const newReceiptStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const newBookingStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED';
    const newPaymentStatus = action === 'approve' ? 'PAID'      : 'FAILED';

    // Update receipt status
    // Persist the receipt's new status, plus who reviewed it and when.
    await prisma.bankTransferReceipt.update({
      where: { id: params.id },
      data:  { status: newReceiptStatus, reviewedAt: new Date(), reviewedBy: admin.email },
    });

    // Record this action in the audit log for accountability/history.
    await logAudit({
      actor: admin.email,
      action: action === 'approve' ? 'RECEIPT_APPROVE' : 'RECEIPT_REJECT',
      entityType: 'BankTransferReceipt',
      entityId: params.id,
      metadata: { bookingNumber: receipt.booking.bookingNumber },
    });

    // Update all bookings for this reservation (primary + multi-room siblings)
    // A single reservation can span multiple rooms, each stored as a
    // separate Booking row sharing a base booking number (e.g. "WVB123"
    // for the primary booking and "WVB123-R2" for additional rooms).
    // updateMany applies the new status to all of them at once.
    const baseNumber = receipt.booking.bookingNumber.split('-R')[0];
    await prisma.booking.updateMany({
      where: {
        OR: [
          { bookingNumber: baseNumber },
          { bookingNumber: { startsWith: `${baseNumber}-R` } },
        ],
      },
      data: { status: newBookingStatus, paymentStatus: newPaymentStatus },
    });

    // Send confirmation email on approval
    // Only email the guest if the receipt was approved and we have an
    // email address to send to.
    if (action === 'approve') {
      const guest = receipt.booking.guestCheckout;
      if (guest?.email) {
        const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        // Fire-and-forget: we don't await/block the response on the
        // email send, but we do log if it fails.
        sendBookingConfirmedEmail({
          to:            guest.email,
          guestName:     `${guest.firstName} ${guest.lastName}`,
          bookingNumber: baseNumber,
          rooms:         receipt.booking.room.name,
          checkIn:       fmtDate(receipt.booking.checkIn),
          checkOut:      fmtDate(receipt.booking.checkOut),
        }).catch(err => console.error('[email] confirmation email failed:', err));
      }
    }

    return NextResponse.json({ success: true, status: newReceiptStatus });
  } catch (error) {
    console.error('[PATCH /api/admin/receipts/[id]]', error);
    return NextResponse.json({ error: 'Failed to update receipt status.' }, { status: 500 });
  }
}
