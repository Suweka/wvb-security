// This route manages concierge requests (e.g. "bring extra towels to room 12").
// GET lists all requests; POST creates a new one. Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// Forces this route to run on the Node.js runtime (instead of the lighter
// "Edge" runtime), which is needed because Prisma relies on Node APIs.
export const runtime = 'nodejs';

// GET /api/admin/concierge
// Returns every concierge request, newest first, as { requests }.
export async function GET(req: NextRequest) {
  // Only allow logged-in admins to view concierge requests.
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Fetch all rows from the ConciergeRequest table, most recent first.
    const requests = await prisma.conciergeRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Concierge GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests.' }, { status: 500 });
  }
}

// POST /api/admin/concierge
// Creates a new concierge request. Expects a JSON body with at least
// guestName and service; other fields are optional. Returns the created
// request as { request } with a 201 Created status.
export async function POST(req: NextRequest) {
  // Only admins can create concierge requests through this endpoint.
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Parse the JSON request body sent by the client.
    const body = await req.json();
    const { guestName, roomNumber, service, description, priority, assignedTo, contact } = body;

    // Basic validation: these two fields are mandatory for a request to
    // make sense. Anything else missing falls back to a default/null below.
    if (!guestName || !service) {
      return NextResponse.json(
        { error: 'Guest name and service are required.' },
        { status: 400 }
      );
    }

    // Insert a new row into the ConciergeRequest table. Optional fields
    // use `?? null`/`?? 'MEDIUM'` so undefined values become explicit
    // defaults instead of being omitted.
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

    // 201 Created signals a new resource was successfully made.
    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error('Concierge POST error:', error);
    return NextResponse.json({ error: 'Failed to create request.' }, { status: 500 });
  }
}
