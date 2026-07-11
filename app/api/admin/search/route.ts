import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SearchResult {
  type:     'booking' | 'guest';
  label:    string;
  sublabel: string;
  href:     string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const [bookings, users, guestCheckouts] = await Promise.all([
      prisma.booking.findMany({
        where: {
          OR: [
            { bookingNumber: { contains: q, mode: 'insensitive' } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { guestCheckout: { firstName: { contains: q, mode: 'insensitive' } } },
            { guestCheckout: { lastName: { contains: q, mode: 'insensitive' } } },
            { guestCheckout: { email: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { user: true, guestCheckout: true },
        take: 5,
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
      prisma.guestCheckout.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
      }),
    ]);

    const results: SearchResult[] = [];

    for (const b of bookings) {
      const guestName = b.user?.name
        || (b.guestCheckout ? `${b.guestCheckout.firstName} ${b.guestCheckout.lastName}` : 'Unknown');
      results.push({
        type: 'booking',
        label: b.bookingNumber,
        sublabel: guestName,
        href: `/admin/reservations?q=${encodeURIComponent(b.bookingNumber)}`,
      });
    }

    for (const u of users) {
      results.push({
        type: 'guest',
        label: u.name || u.email || 'Unnamed guest',
        sublabel: u.email || u.phone || '',
        href: `/admin/guests?q=${encodeURIComponent(u.name || u.email || '')}`,
      });
    }

    for (const g of guestCheckouts) {
      results.push({
        type: 'guest',
        label: `${g.firstName} ${g.lastName}`,
        sublabel: g.email,
        href: `/admin/guests?q=${encodeURIComponent(g.email)}`,
      });
    }

    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (error) {
    console.error('[GET /api/admin/search]', error);
    return NextResponse.json({ results: [] });
  }
}
