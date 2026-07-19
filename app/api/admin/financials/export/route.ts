// This route exports confirmed bookings as a downloadable CSV file for
// financial reporting purposes. Only GET is exposed, and only admins can
// call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

// GET /api/admin/financials/export
// Builds a CSV file listing every CONFIRMED booking (guest, room, dates,
// amount, payment info) and returns it as a file download
// (Content-Disposition: attachment).
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Fetch only confirmed bookings, along with their related room,
    // registered user (if any), and guest checkout (if any) records —
    // `include` tells Prisma to also load those linked tables.
    const bookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED' },
      include: { room: true, user: true, guestCheckout: true },
      orderBy: { checkIn: 'asc' },
    });

    // Helper to safely format a value for a CSV cell: wraps it in quotes
    // (and escapes internal quotes) if it contains a comma, quote, or newline.
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

    // Turn each booking row into one CSV line.
    const rows = bookings.map((b) => {
      // A booking might belong to a registered user OR a guest checkout
      // (not both) — pick whichever is present to display a name/email.
      const guestName = b.user
        ? (b.user.name ?? b.user.email ?? 'User')
        : b.guestCheckout
        ? `${b.guestCheckout.firstName} ${b.guestCheckout.lastName}`
        : 'Unknown';
      const email = b.user?.email ?? b.guestCheckout?.email ?? '';
      // Compute the number of nights stayed from the check-in/check-out
      // dates, always at least 1 night.
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

    // Return a raw Response (not NextResponse.json) so we can set CSV
    // headers and have the browser treat this as a downloadable file.
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
