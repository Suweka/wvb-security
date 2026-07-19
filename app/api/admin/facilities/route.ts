// This route manages hotel facilities/amenities (e.g. "Pool", "Free Wi-Fi").
// GET lists all facilities; POST creates a new one. Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FACILITY_ICON_NAMES, FACILITY_CATEGORIES } from '@/lib/facility-icons';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/facilities
// Returns every facility, alphabetically sorted by label.
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Fetch all facility rows, sorted alphabetically (a-z) by their label.
    const facilities = await prisma.facility.findMany({ orderBy: { label: 'asc' } });
    return NextResponse.json(facilities);
  } catch (error) {
    console.error('List facilities error:', error);
    return NextResponse.json({ error: 'Failed to load facilities.' }, { status: 500 });
  }
}

// POST /api/admin/facilities
// Creates a new facility. Expects { label, icon, category } in the JSON
// body. Falls back to safe defaults if icon/category aren't recognized.
// Returns the created facility with a 201 status.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { label, icon, category } = await req.json();

    // The label is required and must be a non-empty string once trimmed.
    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: 'Label is required.' }, { status: 400 });
    }

    // Create the facility row. If the provided icon/category isn't in the
    // list of allowed values, fall back to sensible defaults ('Check'
    // icon, 'general' category) rather than storing an invalid value.
    const facility = await prisma.facility.create({
      data: {
        label: label.trim(),
        icon: FACILITY_ICON_NAMES.includes(icon) ? icon : 'Check',
        category: FACILITY_CATEGORIES.includes(category) ? category : 'general',
      },
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (error: unknown) {
    // Prisma error code P2002 means a unique constraint was violated —
    // here that means a facility with this label already exists.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A facility with that name already exists.' }, { status: 409 });
    }
    console.error('Create facility error:', error);
    return NextResponse.json({ error: 'Failed to create facility.' }, { status: 500 });
  }
}
