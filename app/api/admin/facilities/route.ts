import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FACILITY_ICON_NAMES, FACILITY_CATEGORIES } from '@/lib/facility-icons';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const facilities = await prisma.facility.findMany({ orderBy: { label: 'asc' } });
    return NextResponse.json(facilities);
  } catch (error) {
    console.error('List facilities error:', error);
    return NextResponse.json({ error: 'Failed to load facilities.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { label, icon, category } = await req.json();

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'Label is required.' }, { status: 400 });
    }

    const facility = await prisma.facility.create({
      data: {
        label: label.trim(),
        icon: FACILITY_ICON_NAMES.includes(icon) ? icon : 'Check',
        category: FACILITY_CATEGORIES.includes(category) ? category : 'general',
      },
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A facility with that name already exists.' }, { status: 409 });
    }
    console.error('Create facility error:', error);
    return NextResponse.json({ error: 'Failed to create facility.' }, { status: 500 });
  }
}
