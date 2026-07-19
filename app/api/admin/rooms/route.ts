// This route creates new hotel rooms. Only POST is exposed here (listing
// rooms happens elsewhere), and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uniqueSlug } from '@/lib/slugify';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// POST /api/admin/rooms
// Expects { name, description?, price, maxGuests?, size?, beds?,
// facilityIds? } in the JSON body. Generates a unique URL slug from the
// name, creates the room (optionally linking facilities), and returns
// the created room with a 201 status.
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, description, price, maxGuests, size, beds, facilityIds } = await req.json();

    // Name and price are the only truly required fields.
    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required.' }, { status: 400 });
    }

    // Turn the room name into a URL-friendly slug (e.g. "Ocean View" ->
    // "ocean-view"), checking the database and appending a number if
    // that slug is already taken by another room.
    const slug = await uniqueSlug(name, async candidate => {
      const existing = await prisma.room.findUnique({ where: { slug: candidate } });
      return existing != null;
    });

    // Insert the new room row. If facilityIds were provided, `connect`
    // links this room to those existing Facility rows (many-to-many).
    const room = await prisma.room.create({
      data: {
        name,
        slug,
        description: description || null,
        price,
        maxGuests: maxGuests != null ? Number(maxGuests) : undefined,
        size: size != null ? Number(size) : undefined,
        beds: beds || null,
        facilities: Array.isArray(facilityIds) && facilityIds.length
          ? { connect: facilityIds.map((id: string) => ({ id })) }
          : undefined,
      },
    });

    // Record this action in the audit log.
    await logAudit({ actor: admin.email, action: 'ROOM_CREATE', entityType: 'Room', entityId: room.id, metadata: { name: room.name } });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 });
  }
}
