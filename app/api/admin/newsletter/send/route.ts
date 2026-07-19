// This route sends a newsletter email broadcast to every active
// subscriber. Only POST is exposed, and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewsletterBroadcast } from '@/lib/email';
import { requireAdmin } from '@/lib/admin-auth';

// POST /api/admin/newsletter/send
// Expects { subject, message } in the JSON body. Emails every active
// subscriber individually and reports how many succeeded/failed.
export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { subject, message } = await request.json();

    // Both fields must have actual (non-whitespace) content.
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
    }

    // Only fetch subscribers who haven't unsubscribed. `select` limits
    // the returned columns to just the email address, since that's all
    // we need here.
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ error: 'No active subscribers found.' }, { status: 400 });
    }

    // Send in small batches to avoid rate-limiting
    // Send one email per subscriber, sequentially, tracking how many
    // succeed vs fail so a single bad email doesn't stop the rest.
    let sent = 0;
    let failed = 0;
    for (const sub of subscribers) {
      try {
        await sendNewsletterBroadcast({ to: sub.email, subject, message });
        sent++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: subscribers.length });
  } catch (error) {
    console.error('[POST /api/admin/newsletter/send]', error);
    return NextResponse.json({ error: 'Failed to send newsletter.' }, { status: 500 });
  }
}
