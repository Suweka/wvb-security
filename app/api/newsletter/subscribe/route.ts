// Handles newsletter sign-ups from the site's subscribe form. Exposes POST only:
// validates the email, creates or reactivates a subscriber row, and sends a
// welcome email.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewsletterWelcomeEmail } from '@/lib/email';

// POST /api/newsletter/subscribe
// Expects JSON body { email }. If the email is new, creates a subscriber and sends
// a welcome email. If it previously unsubscribed, reactivates it. If already
// actively subscribed, just confirms that. Returns a friendly message either way.
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    // Simple regex check for "looks like an email address" (something@something.something).
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    // Check if already subscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email }
    });

    if (existing) {
      if (existing.isActive) {
        return NextResponse.json({ message: 'You are already subscribed!' }, { status: 200 });
      } else {
        // They unsubscribed before — flip isActive back on instead of creating a duplicate row.
        // Re-activate
        await prisma.newsletterSubscriber.update({
          where: { email },
          data: { isActive: true }
        });
        return NextResponse.json({ message: 'Welcome back! Your subscription has been reactivated.' }, { status: 200 });
      }
    }

    // Create new subscriber
    await prisma.newsletterSubscriber.create({
      data: { email }
    });

    // Send welcome email (non-fatal) — fire-and-forget with .catch() so that if the
    // email fails to send, the subscription itself still succeeds and the user
    // still gets a success response; we just log the email error separately.
    sendNewsletterWelcomeEmail({ to: email }).catch(err =>
      console.error('[newsletter] welcome email failed:', err)
    );

    return NextResponse.json({ success: true, message: 'Thank you for subscribing!' }, { status: 201 });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
