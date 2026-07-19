// Lets a guest who paid by bank transfer submit their transfer details (and an
// optional uploaded receipt image URL) so an admin can manually verify the payment.
// Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/bookings/upload-receipt
// Expects JSON body { bookingNumber, transactionRef, transferDate, amountPaid,
// receiptUrl?, notes? }. Looks up the booking by its reference number, checks it
// was actually set up for bank transfer, then creates (or updates, if resubmitted)
// a BankTransferReceipt row with status PENDING for admin review.
export async function POST(request: NextRequest) {
  try {
    const { bookingNumber, transactionRef, transferDate, amountPaid, receiptUrl, notes } = await request.json();

    // Require the core fields needed to identify and verify the transfer.
    if (!bookingNumber || !transactionRef || !transferDate || !amountPaid) {
      return NextResponse.json({ error: 'Transaction reference, date and amount are required.' }, { status: 400 });
    }

    // Look up the booking this receipt belongs to.
    const booking = await prisma.booking.findFirst({
      where: { bookingNumber },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found. Please check your reference number.' }, { status: 404 });
    }

    // Only bookings that chose "bank transfer" as their payment method should
    // be receiving a manually-submitted receipt.
    if (booking.paymentMethod !== 'bank') {
      return NextResponse.json({ error: 'This booking is not set up for bank transfer payment.' }, { status: 400 });
    }

    // Upsert — allow resubmission if they made an error
    // (upsert = "update if a row already exists for this booking, otherwise create one")
    await prisma.bankTransferReceipt.upsert({
      where:  { bookingId: booking.id },
      create: {
        bookingId:     booking.id,
        transactionRef,
        transferDate:  new Date(transferDate),
        amountPaid:    Number(amountPaid),
        receiptUrl:    receiptUrl || null,
        notes:         notes || null,
        status:        'PENDING',
      },
      update: {
        transactionRef,
        transferDate: new Date(transferDate),
        amountPaid:   Number(amountPaid),
        receiptUrl:   receiptUrl || null,
        notes:        notes || null,
        status:       'PENDING',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Any unexpected failure (bad date format, DB error, etc.) is logged server-side
    // and reported back to the client as a generic error.
    console.error('[POST /api/bookings/upload-receipt]', error);
    return NextResponse.json({ error: 'Failed to submit receipt. Please try again.' }, { status: 500 });
  }
}
