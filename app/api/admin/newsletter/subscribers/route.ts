import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ subscribers });
  } catch (error) {
    console.error('[GET /api/admin/newsletter/subscribers]', error);
    return NextResponse.json({ subscribers: [] });
  }
}
