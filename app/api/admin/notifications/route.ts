// This route powers the admin dashboard's notification bell — it
// summarizes unread contact messages and pending bank-transfer receipts
// that need admin attention. Only GET is exposed, and only admins can
// call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/notifications
// Returns a combined notification feed: the 5 most recent unread
// messages and 5 most recent pending receipts, plus total unread/pending
// counts.
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Promise.all runs these four independent database queries at the
    // same time (in parallel) instead of one after another, which is
    // faster since none of them depend on each other's results.
    const [unreadMessages, unreadMessagesCount, pendingReceipts, pendingReceiptsCount] = await Promise.all([
      // The 5 newest unread contact messages.
      prisma.contactMessage.findMany({
        where: { status: 'UNREAD' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Total count of unread messages (for the badge number).
      prisma.contactMessage.count({ where: { status: 'UNREAD' } }),
      // The 5 newest bank-transfer receipts still awaiting review,
      // including their related booking so we can show a booking number.
      prisma.bankTransferReceipt.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { booking: true },
      }),
      // Total count of pending receipts.
      prisma.bankTransferReceipt.count({ where: { status: 'PENDING' } }),
    ]);

    // Combine both notification types into one flat list the UI can render.
    const items = [
      ...unreadMessages.map(m => ({
        label: `New message from ${m.firstName}`,
        sublabel: m.subject,
        href: '/admin/messages',
      })),
      ...pendingReceipts.map(r => ({
        label: `Receipt pending review`,
        sublabel: r.booking.bookingNumber,
        href: '/admin/reservations',
      })),
    ];

    return NextResponse.json({
      count: unreadMessagesCount + pendingReceiptsCount,
      messagesUnread: unreadMessagesCount,
      items,
    });
  } catch (error) {
    // On failure, degrade gracefully with an empty/zeroed response
    // rather than breaking the whole admin dashboard.
    console.error('[GET /api/admin/notifications]', error);
    return NextResponse.json({ count: 0, messagesUnread: 0, items: [] });
  }
}
