// Prepares a payment request for PayHere (a Sri Lankan payment gateway). Exposes
// POST only: given a booking number, it gathers the booking's total amount and
// guest details, computes a security hash PayHere requires, and returns everything
// the frontend needs to redirect the guest to PayHere's hosted checkout page.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// SANDBOX toggles between PayHere's test environment and the real one — controlled
// by an environment variable so it can differ between local dev and production.
const SANDBOX        = process.env.PAYHERE_SANDBOX !== 'false';
const MERCHANT_ID    = process.env.PAYHERE_MERCHANT_ID    || '';
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || '';
const BASE_URL       = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Which PayHere URL to send the guest's browser to, depending on sandbox vs live.
const CHECKOUT_URL = SANDBOX
  ? 'https://sandbox.payhere.lk/pay/checkout'
  : 'https://www.payhere.lk/pay/checkout';

// PayHere hash: MD5(merchant_id + order_id + amount + currency + MD5(secret).toUpperCase()).toUpperCase()
// This hash proves to PayHere that the checkout request genuinely came from us
// (since only we know MERCHANT_SECRET) and that the amount/order details haven't
// been tampered with in transit. crypto.createHash('md5') is Node's built-in
// hashing function; we hash the secret first, then hash it again together with
// the order details, exactly the way PayHere's docs specify.
function makeHash(orderId: string, amount: string, currency: string): string {
  const secretHash = crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
  return crypto
    .createHash('md5')
    .update(`${MERCHANT_ID}${orderId}${amount}${currency}${secretHash}`)
    .digest('hex')
    .toUpperCase();
}

// POST /api/payments/payhere/checkout
// Expects JSON body { bookingNumber }. Loads the booking (and any sibling room
// bookings sharing the same reservation), totals up the amount due, builds the
// guest's billing info, and returns { checkoutUrl, fields } — the target URL and
// the hidden form fields (including the security hash) the client should submit
// to PayHere to start the payment.
export async function POST(request: NextRequest) {
  try {
    // Refuse to proceed if PayHere credentials haven't been set up yet.
    if (!MERCHANT_ID || !MERCHANT_SECRET || MERCHANT_ID === 'your_payhere_merchant_id') {
      return NextResponse.json(
        { error: 'PayHere credentials are not configured. Add PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET to .env' },
        { status: 503 }
      );
    }

    const { bookingNumber } = await request.json();
    if (!bookingNumber) {
      return NextResponse.json({ error: 'bookingNumber is required' }, { status: 400 });
    }

    // Load primary booking and all linked room bookings for this reservation.
    // Multi-room bookings are stored as separate rows sharing a prefix, e.g.
    // "ABC123" (primary) and "ABC123-R2", "ABC123-R3" (extra rooms).
    const allBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { bookingNumber },
          { bookingNumber: { startsWith: `${bookingNumber}-R` } },
        ],
      },
      include: { guestCheckout: true, room: true },
      orderBy: { createdAt: 'asc' },
    });

    if (allBookings.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const primary = allBookings[0];
    const guest   = primary.guestCheckout;

    // Total across all room bookings
    const totalAmount = allBookings
      .reduce((sum, b) => sum + Number(b.totalAmount), 0)
      .toFixed(2);

    const currency = 'LKR';
    const items    = allBookings.map(b => b.room.name).join(', ');

    // Compute the tamper-proof hash PayHere will check when the payment form is submitted.
    const hash = makeHash(bookingNumber, totalAmount, currency);

    // Return the checkout URL plus all the form fields the browser needs to POST
    // to PayHere. notify_url is PayHere's webhook callback — after the guest pays,
    // PayHere calls that URL (app/api/payments/payhere/notify/route.ts) on our
    // server directly to confirm the payment result.
    return NextResponse.json({
      checkoutUrl: CHECKOUT_URL,
      fields: {
        merchant_id:  MERCHANT_ID,
        return_url:   `${BASE_URL}/booking/success?ref=${bookingNumber}`,
        cancel_url:   `${BASE_URL}/booking/cancel?ref=${bookingNumber}`,
        notify_url:   `${BASE_URL}/api/payments/payhere/notify`,
        order_id:     bookingNumber,
        items,
        currency,
        amount:       totalAmount,
        first_name:   guest?.firstName ?? 'Guest',
        last_name:    guest?.lastName  ?? '',
        email:        guest?.email     ?? '',
        phone:        guest?.phone     ?? '',
        address:      'N/A',
        city:         'Nuwara Eliya',
        country:      guest?.country   ?? 'Sri Lanka',
        hash,
      },
    });

  } catch (error) {
    console.error('[POST /api/payments/payhere/checkout]', error);
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }
}
