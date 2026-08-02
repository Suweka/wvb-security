// This route updates or deletes a single room, identified by its id in
// the URL (the [id] folder name). Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// PATCH /api/admin/rooms/[id]
// Partially updates a room. Any of { name, description, price,
// maxGuests, size, beds, facilityIds } may be included in the JSON
// body — only the fields actually provided are changed. Returns the
// updated room.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, description, price, maxGuests, size, beds, facilityIds } = await req.json();

    // Build the update payload dynamically: only include a field if the
    // caller actually sent it (checking `!== undefined`), so omitted
    // fields are left unchanged in the database rather than wiped out.
    const data: Record<string, unknown> = {};
    if (name  !== undefined) data.name        = name;
    if (description !== undefined) data.description = description || null;
    if (price !== undefined) data.price       = price;
    if (maxGuests !== undefined) data.maxGuests = Number(maxGuests);
    if (size !== undefined) data.size = Number(size);
    if (beds !== undefined) data.beds = beds || null;
    if (Array.isArray(facilityIds)) {
      // `set` replaces the room's entire list of linked facilities with
      // exactly this new list (a many-to-many relation update).
      data.facilities = { set: facilityIds.map((id: string) => ({ id })) };
    }

    // Apply the update, then record what changed in the audit log.
    const room = await prisma.room.update({ where: { id: params.id }, data });
    await logAudit({ actor: admin.email, action: 'ROOM_UPDATE', entityType: 'Room', entityId: room.id, metadata: { changes: data } });
    return NextResponse.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 });
  }
}

// DELETE /api/admin/rooms/[id]
// Permanently deletes a room. Fails (500) if the room has related
// records (e.g. bookings) that prevent deletion. Returns { success: true }.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Remove the room row. This can fail if the database has foreign-key
    // constraints (e.g. existing bookings referencing this room).
    await prisma.room.delete({ where: { id: params.id } });
    await logAudit({ actor: admin.email, action: 'ROOM_DELETE', entityType: 'Room', entityId: params.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete room error:', error);
    return NextResponse.json({ error: 'Failed to delete room. It may have associated bookings.' }, { status: 500 });
  }
}
