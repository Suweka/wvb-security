import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [unreadMessages, unreadMessagesCount, pendingReceipts, pendingReceiptsCount] = await Promise.all([
      prisma.contactMessage.findMany({
        where: { status: 'UNREAD' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.contactMessage.count({ where: { status: 'UNREAD' } }),
      prisma.bankTransferReceipt.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { booking: true },
      }),
      prisma.bankTransferReceipt.count({ where: { status: 'PENDING' } }),
    ]);

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
    console.error('[GET /api/admin/notifications]', error);
    return NextResponse.json({ count: 0, messagesUnread: 0, items: [] });
  }
}
