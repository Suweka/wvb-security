import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { title, description, priority, roomId, dueAt } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
    }

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
