import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const requests = await prisma.conciergeRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Concierge GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { guestName, roomNumber, service, description, priority, assignedTo, contact } = body;

    if (!guestName || !service) {
      return NextResponse.json(
        { error: 'Guest name and service are required.' },
        { status: 400 }
      );
    }

    const request = await prisma.conciergeRequest.create({
      data: {
        guestName,
        roomNumber: roomNumber ?? null,
        service,
        description: description ?? null,
        priority: priority ?? 'MEDIUM',
        assignedTo: assignedTo ?? null,
        contact: contact ?? null,
      },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error('Concierge POST error:', error);
    return NextResponse.json({ error: 'Failed to create request.' }, { status: 500 });
  }
}
