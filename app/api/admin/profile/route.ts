import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const profile = await prisma.adminProfile.findUnique({ where: { email } });
    return NextResponse.json({ avatarUrl: profile?.avatarUrl ?? null });
  } catch (error) {
    console.error('[GET /api/admin/profile]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { email, avatarUrl } = await request.json();
    if (!email || !avatarUrl) {
      return NextResponse.json({ error: 'email and avatarUrl are required' }, { status: 400 });
    }

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
