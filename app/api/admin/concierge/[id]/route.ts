import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { action } = await req.json();
    const { id } = params;

    const data: Record<string, unknown> = {};

    if (action === 'start') {
      data.status = 'IN_PROGRESS';
    } else if (action === 'complete') {
      data.status = 'COMPLETED';
      data.completedAt = new Date();
    } else if (action === 'cancel') {
      data.status = 'CANCELLED';
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const request = await prisma.conciergeRequest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ request });
  } catch (error) {
    console.error('Concierge PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update request.' }, { status: 500 });
  }
}
