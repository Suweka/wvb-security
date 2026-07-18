import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;

    // Try registered user first
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { checkIn: 'desc' },
        },
      },
    });

    if (user) {
      const guest = {
        name: user.name ?? 'Unknown',
        email: user.email ?? '',
        phone: user.phone ?? '',
        country: user.country ?? '',
        joinDate: user.createdAt.toISOString(),
        type: 'registered' as const,
      };
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

    // Try guest checkout
    const guestCheckout = await prisma.guestCheckout.findUnique({
      where: { id },
      include: {
        bookings: {
          include: { room: true },
          orderBy: { checkIn: 'desc' },
        },
      },
    });

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

    return NextResponse.json({ error: 'Guest not found.' }, { status: 404 });
  } catch (error) {
    console.error('Guest detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch guest.' }, { status: 500 });
  }
}
