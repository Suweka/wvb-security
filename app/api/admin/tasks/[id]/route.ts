// This route updates a single task, identified by its id in the URL (the
// [id] folder name). Only PATCH is exposed, and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// PATCH /api/admin/tasks/[id]
// Partially updates a task. Any of { status, title, description,
// priority, dueAt } may be included in the JSON body — only fields
// actually provided are changed. If status is set to 'COMPLETED', the
// completedAt timestamp is stamped automatically. Returns the updated task.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { status, title, description, priority, dueAt } = body;

    // Build the update payload dynamically so only the fields the caller
    // actually sent get changed. Note: using truthy checks (`if (status)`)
    // means an empty string/falsy value won't be applied for those fields.
    const data: Record<string, unknown> = {};
    if (status)      data.status      = status;
    if (title)       data.title       = title;
    if (description !== undefined) data.description = description;
    if (priority)    data.priority    = priority;
    if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null;
    // Business rule: whenever a task is marked COMPLETED, record exactly
    // when that happened.
    if (status === 'COMPLETED') data.completedAt = new Date();

    const task = await prisma.task.update({ where: { id: params.id }, data });
    return NextResponse.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
  }
}
