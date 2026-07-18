import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { status, title, description, priority, dueAt } = body;

    const data: Record<string, unknown> = {};
    if (status)      data.status      = status;
    if (title)       data.title       = title;
    if (description !== undefined) data.description = description;
    if (priority)    data.priority    = priority;
    if (dueAt !== undefined) data.dueAt = dueAt ? new Date(dueAt) : null;
    if (status === 'COMPLETED') data.completedAt = new Date();

    const task = await prisma.task.update({ where: { id: params.id }, data });
    return NextResponse.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
  }
}
