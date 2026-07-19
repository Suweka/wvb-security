// This route manages an admin user's own profile data (currently just
// their avatar image). GET fetches an admin's avatar; PATCH sets it.
// Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/profile?email=...
// Looks up the AdminProfile row for the given email query param and
// returns its avatarUrl (or null if no profile exists yet).
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Look up the admin's profile row by their email address.
    const profile = await prisma.adminProfile.findUnique({ where: { email } });
    return NextResponse.json({ avatarUrl: profile?.avatarUrl ?? null });
  } catch (error) {
    console.error('[GET /api/admin/profile]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

// PATCH /api/admin/profile
// Expects { email, avatarUrl } in the JSON body. Creates the admin's
// profile row if it doesn't exist yet, or updates it if it does.
export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { email, avatarUrl } = await request.json();
    if (!email || !avatarUrl) {
      return NextResponse.json({ error: 'email and avatarUrl are required' }, { status: 400 });
    }

    // upsert = "update or insert": if a profile row for this email
    // already exists, update its avatarUrl; otherwise create a new row.
    const profile = await prisma.adminProfile.upsert({
      where:  { email },
      update: { avatarUrl },
      create: { email, avatarUrl },
    });

    return NextResponse.json({ avatarUrl: profile.avatarUrl });
  } catch (error) {
    console.error('[PATCH /api/admin/profile]', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
