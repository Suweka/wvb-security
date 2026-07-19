// This route powers the admin dashboard's global search box, letting
// admins search across bookings, registered users, and guest checkouts
// by a single query string. Only GET is exposed, and only admins can
// call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// Shape of each item returned in the search results list.
interface SearchResult {
  type:     'booking' | 'guest';
  label:    string;
  sublabel: string;
  href:     string;
}

// GET /api/admin/search?q=...
// Searches bookings, users, and guest checkouts for the query string `q`
// (case-insensitive partial match across several fields), and returns up
// to 10 combined results as { results }. Returns an empty list if `q` is
// missing or shorter than 2 characters.
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  // Skip searching for very short queries — they'd match too much and
  // aren't useful yet.
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    // Run three independent searches in parallel: bookings, registered
    // users, and guest checkouts. Each uses `contains` with
    // `mode: 'insensitive'` for a case-insensitive "contains" match, and
    // `OR` to match on any of several fields.
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

    // Turn each matching booking into a search result, linking to the
    // reservations page filtered by its booking number.
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

    // Turn each matching registered user into a search result.
    for (const u of users) {
      results.push({
        type: 'guest',
        label: u.name || u.email || 'Unnamed guest',
        sublabel: u.email || u.phone || '',
        href: `/admin/guests?q=${encodeURIComponent(u.name || u.email || '')}`,
      });
    }

    // Turn each matching guest checkout into a search result.
    for (const g of guestCheckouts) {
      results.push({
        type: 'guest',
        label: `${g.firstName} ${g.lastName}`,
        sublabel: g.email,
        href: `/admin/guests?q=${encodeURIComponent(g.email)}`,
      });
    }

    // Cap the combined results at 10 total across all three types.
    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (error) {
    console.error('[GET /api/admin/search]', error);
    return NextResponse.json({ results: [] });
  }
}
