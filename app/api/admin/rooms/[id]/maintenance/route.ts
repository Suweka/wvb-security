// This route toggles a room's maintenance state. There's no separate
// "maintenance" flag on the Room model — instead, maintenance is
// represented by the presence of an open Task with category MAINTENANCE
// for that room. Only admins can call these endpoints.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// POST /api/admin/rooms/[id]/maintenance
// Puts a room under maintenance by creating an open MAINTENANCE task for it.
// Room status on /admin/rooms and public visibility both derive from this.
// Expects an optional { note } in the JSON body (used as the task's
// description). Returns the created task with a 201 status.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Parse the body; if it's missing/invalid JSON, fall back to an
    // object with no note instead of throwing.
    const { note } = await req.json().catch(() => ({ note: undefined }));

    // Confirm the room exists before creating a task for it.
    const room = await prisma.room.findUnique({ where: { id: params.id } });
    if (!room) {
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    }

    // Create a high-priority MAINTENANCE task linked to this room. The
    // rest of the app treats "has an open MAINTENANCE task" as meaning
    // "this room is under maintenance".
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

    // Record this action in the audit log.
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

// DELETE /api/admin/rooms/[id]/maintenance
// Resolves maintenance by completing every open MAINTENANCE task for the room.
// Returns { success: true, tasksResolved } with how many tasks were closed.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Mark every not-yet-completed MAINTENANCE task for this room as
    // COMPLETED. Once none remain open, the room is no longer considered
    // "under maintenance" elsewhere in the app.
    const result = await prisma.task.updateMany({
      where: { roomId: params.id, category: 'MAINTENANCE', status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Record this action in the audit log.
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
