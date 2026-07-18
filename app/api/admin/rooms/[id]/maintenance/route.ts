import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// Puts a room under maintenance by creating an open MAINTENANCE task for it.
// Room status on /admin/rooms and public visibility both derive from this.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { note } = await req.json().catch(() => ({ note: undefined }));

    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    const task = await prisma.task.create({
      data: {
        title: `${room.name} — under maintenance`,
        description: note || null,
        priority: 'HIGH',
        status: 'PENDING',
        category: 'MAINTENANCE',
        roomId: room.id,
      },
    });

    await logAudit({
      actor: admin.email,
      action: 'ROOM_MAINTENANCE_START',
      entityType: 'Room',
      entityId: room.id,
      metadata: { taskId: task.id, note: note || null },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error('Start room maintenance error:', error);
    return NextResponse.json({ error: 'Failed to mark room under maintenance.' }, { status: 500 });
  }
}

// Resolves maintenance by completing every open MAINTENANCE task for the room.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await prisma.task.updateMany({
      where: { roomId: params.id, category: 'MAINTENANCE', status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await logAudit({
      actor: admin.email,
      action: 'ROOM_MAINTENANCE_END',
      entityType: 'Room',
      entityId: params.id,
      metadata: { tasksResolved: result.count },
    });

    return NextResponse.json({ success: true, tasksResolved: result.count });
  } catch (error) {
    console.error('Resolve room maintenance error:', error);
    return NextResponse.json({ error: 'Failed to resolve maintenance.' }, { status: 500 });
  }
}
