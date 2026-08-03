// Server Actions used by the admin dashboard pages to fetch data straight from
// the database (bookings, rooms, guests, tasks, reviews, financials). Each
// function queries Prisma, reshapes the result into simple plain objects the
// UI can render, and returns null (logging the error) if the query fails.
'use server'; // Marks every export in this file as a Next.js Server Action — runs only on the server, callable directly from client components.

import { prisma } from '@/lib/prisma';
import { requireAdminAction } from '@/lib/admin-auth';

// Gathers the headline numbers shown on the admin dashboard: booking counts by
// status, total paid revenue, room availability today, the 5 most recent
// bookings, and the 5 highest-priority open tasks.
export async function getDashboardStats() {
  // Server Actions like this one are callable directly (bypassing the React
  // page and its client-side redirect entirely), so the auth check has to
  // live in here, not just on the page that calls it.
  if (!(await requireAdminAction())) return null;
  try {
    // 1. Get total bookings and status counts
    const totalBookings = await prisma.booking.count();
    const confirmedBookings = await prisma.booking.count({
      where: { status: 'CONFIRMED' }
    });
    const pendingBookings = await prisma.booking.count({
      where: { status: 'PENDING' }
    });
    const cancelledBookings = await prisma.booking.count({
      where: { status: 'CANCELLED' }
    });

    // 2. Get total revenue (sum of PAID bookings)
    const totalRevenue = await prisma.booking.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: {
        totalAmount: true
      }
    });

    // 3. Get Room Availability
    const totalRooms = await prisma.room.count();
    // For simplicity, let's assume rooms with active bookings today are "booked"
    const today = new Date();
    today.setHours(0, 0, 0, 0); // zero out the time so we compare whole calendar days, not exact timestamps
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // (tomorrow is computed but not currently used below)

    const activeBookingsCount = await prisma.booking.count({
      where: {
        status: 'CONFIRMED',
        checkIn: { lte: today },
        checkOut: { gte: today }
      }
    });

    const roomStats = {
      total: totalRooms,
      booked: activeBookingsCount,
      available: Math.max(0, totalRooms - activeBookingsCount),
      maintenance: 0 // In a real app, you'd check Task status for maintenance
    };

    // 4. Recent Bookings (limit 5)
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        guestCheckout: true,
        room: true
      }
    });

    // 5. Active Tasks
    const activeTasks = await prisma.task.findMany({
      where: {
        status: { not: 'COMPLETED' }
      },
      take: 5,
      orderBy: { priority: 'desc' }
    });

    // 6. Bookings by source (website vs phone/WhatsApp/walk-in logged by an
    // admin). groupBy gives us one row per source value that actually has at
    // least one booking; we then fill in any missing sources as 0 so the
    // dashboard always shows all four bars, not just whichever exist so far.
    const sourceCounts = await prisma.booking.groupBy({
      by: ['source'],
      _count: { _all: true },
    });
    const countBySource: Record<string, number> = { WEBSITE: 0, PHONE: 0, WHATSAPP: 0, WALK_IN: 0 };
    sourceCounts.forEach(row => { countBySource[row.source] = row._count._all; });
    const SOURCE_LABELS: Record<string, string> = {
      WEBSITE: 'Website (Direct)',
      PHONE: 'Phone Call',
      WHATSAPP: 'WhatsApp',
      WALK_IN: 'Walk-in / Guest Show-up',
    };
    const bookingsBySource = Object.entries(countBySource).map(([source, count]) => ({
      source,
      label: SOURCE_LABELS[source],
      count,
      // Percentage of all bookings this source accounts for, rounded to a whole number.
      percentage: totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0,
    }));

    return {
      stats: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
        revenue: totalRevenue._sum.totalAmount || 0
      },
      roomStats,
      recentBookings: recentBookings.map(b => ({
        id: b.id,
        guest: b.user?.name || `${b.guestCheckout?.firstName} ${b.guestCheckout?.lastName}` || 'Unknown',
        room: b.room.name,
        checkIn: b.checkIn.toISOString().split('T')[0],
        status: b.status.toLowerCase(),
        amount: Number(b.totalAmount)
      })),
      tasks: activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority.toLowerCase(),
        time: t.dueAt ? t.dueAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No deadline'
      })),
      bookingsBySource
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}

// Fetches every room along with its current status (available / booked /
// under maintenance / being cleaned), used by the admin "Rooms" page.
export async function getRoomsData() {
  if (!(await requireAdminAction())) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // start of today, for the "is this room booked right now" check below

    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          where: {
            status: 'CONFIRMED',
            checkIn: { lte: today },
            checkOut: { gte: today },
          },
        },
        tasks: {
          where: { status: { not: 'COMPLETED' } },
        },
        images: { orderBy: { order: 'asc' } },
        facilities: true,
      },
      orderBy: { name: 'asc' },
    });

    return rooms.map(r => {
      const isBooked = r.bookings.length > 0; // bookings array was already filtered to "confirmed & covers today" in the query above
      const hasMaintenance = r.tasks.some(t => t.category === 'MAINTENANCE');
      const hasCleaning = r.tasks.some(t => t.category === 'HOUSEKEEPING');
      // Priority order: booked > maintenance > cleaning > available.
      const status: 'available' | 'booked' | 'maintenance' | 'cleaning' =
        isBooked ? 'booked' : hasMaintenance ? 'maintenance' : hasCleaning ? 'cleaning' : 'available';

      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description || '',
        price: Number(r.price),
        maxGuests: r.maxGuests,
        size: r.size,
        beds: r.beds || '',
        status,
        activeTaskCount: r.tasks.length,
        images: r.images.map(img => ({ id: img.id, url: img.url, order: img.order })),
        facilities: r.facilities.map(f => ({ id: f.id, label: f.label, icon: f.icon, category: f.category })),
      };
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return null;
  }
}

// Fetches every booking (both from registered users and guest checkouts) for
// the admin "Reservations" table, including any bank transfer receipt attached.
export async function getReservationsData() {
  if (!(await requireAdminAction())) return null;
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        room:               true,
        user:               true,
        guestCheckout:      true,
        bankTransferReceipt: true,
        payment:            true,
        refundRequest:      true,
      },
    });

    return bookings.map(b => {
      // Difference between check-out and check-in in milliseconds, converted to
      // whole days. Math.ceil rounds up so a partial-day difference still counts
      // as a full night.
      const nights = Math.ceil(
        (b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      // A booking belongs either to a signed-in `user` or a one-off `guestCheckout`
      // (no account) — fall back through both to find a display name/contact info.
      const guestName = b.user?.name
        || (b.guestCheckout ? `${b.guestCheckout.firstName} ${b.guestCheckout.lastName}` : 'Unknown');
      const email = b.user?.email || b.guestCheckout?.email || '';
      const phone = b.user?.phone || b.guestCheckout?.phone || '';
      const r = b.bankTransferReceipt;
      // Only one of these is ever set per booking — see guestCheckout.create
      // in app/api/bookings/route.ts. Absent entirely for bookings made
      // while foreign pricing was switched off.
      const idNumber = b.guestCheckout?.nicNumber
        ? { type: 'NIC' as const, value: b.guestCheckout.nicNumber }
        : b.guestCheckout?.passportNumber
        ? { type: 'Passport' as const, value: b.guestCheckout.passportNumber }
        : null;

      return {
        id: b.bookingNumber,
        guestName,
        email,
        phone,
        idNumber,
        room: b.room.name,
        roomId: b.roomId,
        checkIn: b.checkIn.toISOString().split('T')[0],
        checkOut: b.checkOut.toISOString().split('T')[0],
        nights,
        amount: Number(b.totalAmount),
        status: b.status.toLowerCase() as 'confirmed' | 'pending' | 'cancelled',
        guests: b.guests,
        paymentMethod: b.paymentMethod || null,
        // Booking-level payment status (covers bank transfers, which have no
        // Payment row — receipt approval flips this to PAID directly).
        paymentStatus: b.paymentStatus,
        payment: b.payment ? {
          status:     b.payment.status,
          // Refundable through the API only if PayHere's own payment id was
          // captured (bank transfers and pre-refund-feature payments won't have one).
          refundable: Boolean(b.payment.payhereId),
          refundedAt: b.payment.refundedAt?.toISOString().split('T')[0] ?? null,
        } : null,
        refundRequest: b.refundRequest ? {
          status:    b.refundRequest.status,
          amount:    Number(b.refundRequest.amount),
          rule:      b.refundRequest.rule,
          reason:    b.refundRequest.reason,
          adminNote: b.refundRequest.adminNote,
          createdAt: b.refundRequest.createdAt.toISOString().split('T')[0],
        } : null,
        receipt: r ? {
          id:             r.id,
          transactionRef: r.transactionRef,
          transferDate:   r.transferDate?.toISOString().split('T')[0] ?? null,
          amountPaid:     r.amountPaid ? Number(r.amountPaid) : null,
          receiptUrl:     r.receiptUrl,
          notes:          r.notes,
          status:         r.status,
        } : null,
      };
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return null;
  }
}

// Builds the admin "Guests" list by combining two different sources: registered
// `User` accounts and one-off `GuestCheckout` records (people who booked without
// creating an account), then sorting everyone together by join date.
export async function getGuestsData() {
  if (!(await requireAdminAction())) return null;
  try {
    const users = await prisma.user.findMany({
      where: { role: 'GUEST' },
      include: {
        bookings: {
          include: { room: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const guestCheckouts = await prisma.guestCheckout.findMany({
      include: { bookings: true },
      orderBy: { createdAt: 'desc' },
    });

    // reduce() adds up totalAmount across all of this user's bookings to get their lifetime spend.
    const fromUsers = users.map(u => {
      const totalSpent = u.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const lastBooking = u.bookings.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];
      return {
        id: u.id,
        name: u.name || u.email || 'Unknown',
        email: u.email || '',
        phone: u.phone || '',
        country: u.country || '',
        totalStays: u.bookings.length,
        totalSpent,
        lastVisit: lastBooking ? lastBooking.checkIn.toISOString().split('T')[0] : null,
        joinDate: u.createdAt.toISOString().split('T')[0],
        type: 'registered' as const,
      };
    });

    const fromGuests = guestCheckouts.map(g => {
      const totalSpent = g.bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const lastBooking = g.bookings.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];
      return {
        id: g.id,
        name: `${g.firstName} ${g.lastName}`,
        email: g.email,
        phone: g.phone,
        country: g.country || '',
        totalStays: g.bookings.length,
        totalSpent,
        lastVisit: lastBooking ? lastBooking.checkIn.toISOString().split('T')[0] : null,
        joinDate: g.createdAt.toISOString().split('T')[0],
        type: 'guest' as const,
      };
    });

    return [...fromUsers, ...fromGuests].sort(
      (a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime()
    );
  } catch (error) {
    console.error('Error fetching guests:', error);
    return null;
  }
}

// Fetches all HOUSEKEEPING-category tasks for the admin housekeeping board,
// reshaping Prisma's enum-style status/priority values into the lowercase
// strings the UI expects.
export async function getHousekeepingData() {
  if (!(await requireAdminAction())) return null;
  try {
    const tasks = await prisma.task.findMany({
      where: { category: 'HOUSEKEEPING' },
      include: { user: true, room: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks.map(t => ({
      id: t.id,
      roomName: t.room?.name || 'General',
      title: t.title,
      description: t.description || '',
      assignedTo: t.user?.name || 'Unassigned',
      status: t.status === 'IN_PROGRESS' ? 'in-progress' : t.status.toLowerCase() as 'pending' | 'in-progress' | 'completed',
      priority: t.priority.toLowerCase() as 'low' | 'medium' | 'high',
      dueAt: t.dueAt ? t.dueAt.toISOString().split('T')[0] : null,
    }));
  } catch (error) {
    console.error('Error fetching housekeeping tasks:', error);
    return null;
  }
}

// Fetches non-cancelled bookings (ordered by check-in date) for the admin
// booking calendar view.
export async function getCalendarData() {
  if (!(await requireAdminAction())) return null;
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: { room: true, user: true, guestCheckout: true },
      orderBy: { checkIn: 'asc' },
    });

    return bookings.map(b => ({
      id:        b.id,
      guestName: b.user?.name || (b.guestCheckout ? `${b.guestCheckout.firstName} ${b.guestCheckout.lastName}` : 'Guest'),
      room:      b.room.name,
      checkIn:   b.checkIn.toISOString().split('T')[0],
      checkOut:  b.checkOut.toISOString().split('T')[0],
      status:    b.status.toLowerCase() as 'confirmed' | 'pending',
    }));
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return null;
  }
}

// Fetches all guest reviews (with reviewer and room info) for the admin
// "Reviews" page, newest first.
export async function getReviewsData() {
  if (!(await requireAdminAction())) return null;
  try {
    const reviews = await prisma.review.findMany({
      include: { user: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
    return reviews.map(r => ({
      id: r.id,
      guestName: r.user.name || r.user.email || 'Guest',
      rating: r.rating as 1 | 2 | 3 | 4 | 5,
      comment: r.comment || '',
      room: r.room.name,
      createdAt: r.createdAt.toISOString().split('T')[0],
    }));
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return null;
  }
}

// Builds the numbers for the admin "Financials" page: total paid revenue,
// a rough occupancy-rate estimate, and a revenue-by-month breakdown for the
// last 6 months (for a chart).
export async function getFinancialsData() {
  if (!(await requireAdminAction())) return null;
  try {
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const totalBookings = await prisma.booking.count();
    const confirmedBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
    const totalRooms = await prisma.room.count();

    // Rough estimate: confirmed bookings divided by "room-nights available in a
    // 30-day month" (totalRooms * 30). Not a precise occupancy calculation, but
    // good enough for a dashboard summary figure.
    const occupancyRate = totalRooms > 0
      ? Math.round((confirmedBookings / (totalRooms * 30)) * 100)
      : 0;

    // Revenue by month (last 6 months)
    const now = new Date();
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    // Loop from 5 months ago down to the current month (i=0), building one
    // start/end date range per month and summing paid payments within it.
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      // Day 0 of next month = last day of this month (same trick as in DatePickerField).
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const result = await prisma.payment.aggregate({
        where: { status: 'PAID', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      });
      monthlyRevenue.push({
        month: d.toLocaleString('en-US', { month: 'short' }),
        revenue: Number(result._sum.amount || 0),
      });
    }

    const revenue = Number(totalRevenue._sum.amount || 0);

    return {
      totalRevenue: revenue,
      totalBookings,
      occupancyRate: Math.min(occupancyRate, 100), // clamp so a rough estimate can never display over 100%
      monthlyRevenue,
    };
  } catch (error) {
    console.error('Error fetching financials:', error);
    return null;
  }
}
