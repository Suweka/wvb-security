// This is PayHere's server-to-server "notify" webhook — after a guest pays (or
// fails to pay) on PayHere's hosted checkout page, PayHere's own servers send a
// POST request directly to this endpoint (not through the guest's browser) to
// report the final payment result. We verify the request is genuinely from
// PayHere (via a signature check), then update our booking/payment records and
// email the guest a confirmation. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendBookingConfirmedEmail } from '@/lib/email';

const MERCHANT_ID     = process.env.PAYHERE_MERCHANT_ID     || '';
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || '';

// PayHere status codes
// 2  = Successful
// 0  = Pending
// -1 = Cancelled
// -2 = Failed
// -3 = Chargedback
// Translates PayHere's numeric status_code into our own internal booking/payment
// statuses, so the rest of the app doesn't need to know PayHere's specific codes.
function resolveStatuses(statusCode: string): {
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  bookingStatus:  'CONFIRMED' | 'PENDING' | 'CANCELLED';
} {
  switch (statusCode) {
    case '2':  return { paymentStatus: 'PAID',    bookingStatus: 'CONFIRMED' };
    case '0':  return { paymentStatus: 'PENDING', bookingStatus: 'PENDING'   };
    case '-1': return { paymentStatus: 'FAILED',  bookingStatus: 'CANCELLED' };
    default:   return { paymentStatus: 'FAILED',  bookingStatus: 'PENDING'   };
  }
}

// POST /api/payments/payhere/notify
// Called directly by PayHere's servers (not by the guest's browser) with form-encoded
// data describing a payment result: merchant_id, order_id, payhere_amount,
// payhere_currency, status_code, and md5sig (a signature). We must verify the
// signature before trusting any of this data, since this endpoint is a public URL
// that anyone could otherwise POST fake "payment successful" data to.
export async function POST(request: NextRequest) {
  try {
    // PayHere sends this as multipart/form-data (like an HTML form submission),
    // not JSON — so we read it with request.formData() instead of request.json().
    const formData = await request.formData();
    const get = (key: string) => formData.get(key)?.toString() ?? '';

    const merchantId      = get('merchant_id');
    const orderId         = get('order_id');
    const payhereAmount   = get('payhere_amount');
    const payhereCurrency = get('payhere_currency');
    const statusCode      = get('status_code');
    const md5sig          = get('md5sig');

    // 1. Verify merchant ID matches ours
    // Sanity check: this notification should be about a payment made to our merchant account.
    if (merchantId !== MERCHANT_ID) {
      console.warn('[notify] merchant_id mismatch');
      return NextResponse.json({ error: 'Invalid merchant' }, { status: 400 });
    }

    // 2. Verify MD5 signature
    // MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(secret).toUpperCase()).toUpperCase()
    // We recompute the same hash PayHere should have generated (using our shared
    // secret, which only PayHere and we know) and compare it to the md5sig they
    // sent. If they don't match, this request did not genuinely come from PayHere
    // (or the data was altered in transit), so we reject it — this is the critical
    // security check that stops attackers from faking "payment successful" calls.
    const secretHash = crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
    const expected   = crypto
      .createHash('md5')
      .update(`${merchantId}${orderId}${payhereAmount}${payhereCurrency}${statusCode}${secretHash}`)
      .digest('hex')
      .toUpperCase();

    if (md5sig !== expected) {
      console.warn('[notify] signature mismatch — possible spoofed request');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Signature verified — safe to trust statusCode now. Map it to our own statuses.
    const { paymentStatus, bookingStatus } = resolveStatuses(statusCode);

    // 3. Update all bookings for this reservation (primary + multi-room siblings)
    // Multi-room reservations share a bookingNumber prefix (e.g. "ABC123-R2"), so
    // this updates every room booking tied to this order, not just one row.
    await prisma.booking.updateMany({
      where: {
        OR: [
          { bookingNumber: orderId },
          { bookingNumber: { startsWith: `${orderId}-R` } },
        ],
      },
      data: {
        paymentStatus,
        status: bookingStatus,
      },
    });

    // 4. Upsert a Payment record for the primary booking
    // (upsert = create a new Payment row if one doesn't exist yet for this booking,
    // otherwise update the existing one — handles PayHere possibly notifying us
    // more than once for the same order).
    const primary = await prisma.booking.findFirst({
      where: { bookingNumber: orderId },
    });

    if (primary) {
      await prisma.payment.upsert({
        where:  { bookingId: primary.id },
        create: { bookingId: primary.id, amount: Number(payhereAmount), status: paymentStatus },
        update: { status: paymentStatus, amount: Number(payhereAmount) },
      });

      // Send confirmation email on successful PayHere payment
      // (statusCode '2' = Successful, see the lookup table above).
      if (statusCode === '2') {
        const booking = await prisma.booking.findFirst({
          where:   { bookingNumber: orderId },
          include: { guestCheckout: true, room: true },
        });
        const guest = booking?.guestCheckout;
        if (guest?.email && booking) {
          const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          // Fire-and-forget with .catch(): don't let an email failure break the
          // webhook response — PayHere just needs to know we received the notification.
          sendBookingConfirmedEmail({
            to:            guest.email,
            guestName:     `${guest.firstName} ${guest.lastName}`,
            bookingNumber: orderId,
            rooms:         booking.room.name,
            checkIn:       fmtDate(booking.checkIn),
            checkOut:      fmtDate(booking.checkOut),
          }).catch(err => console.error('[email] payhere confirmation email failed:', err));
        }
      }
    }

    console.log(`[notify] order=${orderId} status=${statusCode} (${paymentStatus})`);
    // PayHere expects a 200-range response to consider the notification delivered.
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[POST /api/payments/payhere/notify]', error);
    // Return 200 so PayHere doesn't keep retrying on our internal errors
    // (PayHere will retry a failing webhook repeatedly, which could cause
    // duplicate processing — better to log the error internally and acknowledge
    // receipt anyway).
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
