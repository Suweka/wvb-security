// This route lists newsletter subscribers for the admin dashboard. Only
// GET is exposed, and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/newsletter/subscribers
// Returns every subscriber (active or not), newest first, as { subscribers }.
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // `select` limits which columns come back — just the fields the
    // admin UI actually needs, not the whole row.
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ subscribers });
  } catch (error) {
    // On failure, return an empty list rather than an error status so
    // the admin UI can render gracefully instead of breaking.
    console.error('[GET /api/admin/newsletter/subscribers]', error);
    return NextResponse.json({ subscribers: [] });
  }
}
