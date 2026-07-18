import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, description, price, maxGuests, size, beds, facilityIds } = await req.json();

    const data: Record<string, unknown> = {};
    if (name  !== undefined) data.name        = name;
    if (description !== undefined) data.description = description || null;
    if (price !== undefined) data.price       = price;
    if (maxGuests !== undefined) data.maxGuests = Number(maxGuests);
    if (size !== undefined) data.size = Number(size);
    if (beds !== undefined) data.beds = beds || null;
    if (Array.isArray(facilityIds)) {
      data.facilities = { set: facilityIds.map((id: string) => ({ id })) };
    }

    const room = await prisma.room.update({ where: { id: params.id }, data });
    await logAudit({ actor: admin.email, action: 'ROOM_UPDATE', entityType: 'Room', entityId: room.id, metadata: { changes: data } });
    return NextResponse.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.room.delete({ where: { id: params.id } });
    await logAudit({ actor: admin.email, action: 'ROOM_DELETE', entityType: 'Room', entityId: params.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete room error:', error);
    return NextResponse.json({ error: 'Failed to delete room. It may have associated bookings.' }, { status: 500 });
  }
}
