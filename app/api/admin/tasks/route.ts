// This route creates new housekeeping tasks for admins/staff to work
// through (e.g. "clean room 5"). Only POST is exposed here (listing
// tasks happens elsewhere), and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// POST /api/admin/tasks
// Expects { title, description?, priority?, roomId?, dueAt? } in the
// JSON body. Creates a new HOUSEKEEPING-category task and returns it
// (with its linked room and assigned user, if any) with a 201 status.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { title, description, priority, roomId, dueAt } = await req.json();

    // A task must at least have a title.
    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

    // Insert the new task row, defaulting priority to MEDIUM and
    // category to HOUSEKEEPING (this endpoint is specifically for
    // housekeeping tasks — maintenance tasks are created elsewhere).
    // `include` also fetches the linked room/user rows in the response.
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority:    priority   || 'MEDIUM',
        category:    'HOUSEKEEPING',
        roomId:      roomId     || null,
        dueAt:       dueAt      ? new Date(dueAt) : null,
      },
      include: { room: true, user: true },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
  }
}
