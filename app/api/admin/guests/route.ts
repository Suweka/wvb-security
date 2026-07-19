// This route lets admins manually create a new "guest checkout" record —
// a guest who isn't a registered user (e.g. booked over the phone). Only
// POST is exposed, and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

// POST /api/admin/guests
// Creates a new guest checkout record. Expects { firstName, lastName,
// email, phone?, country? } in the JSON body. Returns the created guest
// with a 201 status.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, country } = body;

    // These three fields are mandatory to identify a guest.
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required.' },
        { status: 400 }
      );
    }

    // Insert a new row in the GuestCheckout table (guests without a full
    // user account). Optional fields default to empty string/null.
    const guest = await prisma.guestCheckout.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone ?? '',
        country: country ?? null,
      },
    });

    return NextResponse.json({ success: true, guest }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create guest error:', error);
    // Prisma error code P2002 = unique constraint violation, meaning a
    // guest with this email already exists in the table.
    const msg =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
        ? 'A guest with this email already exists.'
        : 'Failed to create guest.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
