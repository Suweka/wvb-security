// This route manages an admin user's own profile data (currently just
// their avatar image). GET fetches an admin's avatar; PATCH sets it.
// Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/profile?email=...
// Looks up the Admin row for the given email query param and returns its
// avatarUrl (or null if the admin has none set).
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email }, select: { avatarUrl: true } });
    return NextResponse.json({ avatarUrl: admin?.avatarUrl ?? null });
  } catch (error) {
    console.error('[GET /api/admin/profile]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

// PATCH /api/admin/profile
// Expects { email, avatarUrl } in the JSON body. Updates the avatar on the
// admin's own Admin row.
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { email, avatarUrl } = await request.json();
    if (!email || !avatarUrl) {
      return NextResponse.json({ error: 'email and avatarUrl are required' }, { status: 400 });
    }

    const admin = await prisma.admin.update({
      where: { email },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ avatarUrl: admin.avatarUrl });
  } catch (error) {
    console.error('[PATCH /api/admin/profile]', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
