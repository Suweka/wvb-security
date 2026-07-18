import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED' },
      include: { room: true, user: true, guestCheckout: true },
      orderBy: { checkIn: 'asc' },
    });

    const escape = (val: string | null | undefined) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const header =
      'Booking Ref,Guest Name,Email,Room,Check-In,Check-Out,Nights,Amount (LKR),Payment Method,Payment Status';

    const rows = bookings.map((b) => {
      const guestName = b.user
        ? (b.user.name ?? b.user.email ?? 'User')
        : b.guestCheckout
        ? `${b.guestCheckout.firstName} ${b.guestCheckout.lastName}`
        : 'Unknown';
      const email = b.user?.email ?? b.guestCheckout?.email ?? '';
      const nights = Math.max(
        1,
        Math.round(
          (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return [
        escape(b.bookingNumber),
        escape(guestName),
        escape(email),
        escape(b.room.name),
        escape(b.checkIn.toISOString().split('T')[0]),
        escape(b.checkOut.toISOString().split('T')[0]),
        String(nights),
        String(Number(b.totalAmount)),
        escape(b.paymentMethod),
        escape(b.paymentStatus),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="wvb-bookings.csv"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response('Failed to export.', { status: 500 });
  }
}
