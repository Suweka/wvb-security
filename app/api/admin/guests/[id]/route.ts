// This route fetches a single guest's profile and booking history for the
// admin guest-detail page. The guest may be either a registered user or a
// one-off guest checkout — this route checks both. Only GET is exposed,
// and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

// GET /api/admin/guests/[id]
// Looks up the guest by id — first as a registered User, then as a
// GuestCheckout — along with their booking history. Returns
// { guest, bookings } or 404 if neither record exists.
export async function GET(
  req: NextRequest,
  // `params.id` comes from the "[id]" dynamic route segment in the URL.
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;

    // Try registered user first: look up a registered account with this
    // id, plus all of their bookings (each including its room), newest
    // booking first.
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { checkIn: 'desc' },
        },
      },
    });

    // If we found a matching user, shape the response and return early.
    if (user) {
      const guest = {
        name: user.name ?? 'Unknown',
        email: user.email ?? '',
        phone: user.phone ?? '',
        country: user.country ?? '',
        joinDate: user.createdAt.toISOString(),
        type: 'registered' as const,
      };
      // Reshape each booking into a simpler object for the frontend,
      // computing the nights stayed from the check-in/check-out dates.
      const bookings = user.bookings.map((b) => {
        const nights = Math.max(
          1,
          Math.round(
            (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        return {
          bookingNumber: b.bookingNumber,
          room: b.room.name,
          checkIn: b.checkIn.toISOString(),
          checkOut: b.checkOut.toISOString(),
          nights,
          amount: Number(b.totalAmount),
          status: b.status,
          paymentMethod: b.paymentMethod ?? 'N/A',
        };
      });
      return NextResponse.json({ guest, bookings });
    }

    // No registered user matched — try the GuestCheckout table instead
    // (guests who booked without creating an account).
    const guestCheckout = await prisma.guestCheckout.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { checkIn: 'desc' },
        },
      },
    });

    // If we found a matching guest checkout, shape the response the same
    // way as above and return.
    if (guestCheckout) {
      const guest = {
        name: `${guestCheckout.firstName} ${guestCheckout.lastName}`,
        email: guestCheckout.email,
        phone: guestCheckout.phone ?? '',
        country: guestCheckout.country ?? '',
        joinDate: guestCheckout.createdAt.toISOString(),
        type: 'guest' as const,
      };
      const bookings = guestCheckout.bookings.map((b) => {
        const nights = Math.max(
          1,
          Math.round(
            (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        return {
          bookingNumber: b.bookingNumber,
          room: b.room.name,
          checkIn: b.checkIn.toISOString(),
          checkOut: b.checkOut.toISOString(),
          nights,
          amount: Number(b.totalAmount),
          status: b.status,
          paymentMethod: b.paymentMethod ?? 'N/A',
        };
      });
      return NextResponse.json({ guest, bookings });
    }

    // Neither a User nor a GuestCheckout matched this id.
    return NextResponse.json({ error: 'Guest not found.' }, { status: 404 });
  } catch (error) {
    console.error('Guest detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch guest.' }, { status: 500 });
  }
}
