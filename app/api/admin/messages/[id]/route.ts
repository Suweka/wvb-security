import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;
    const body = await req.json();
    const { action, reply } = body;

    if (action === 'star') {
      const msg = await prisma.contactMessage.findUnique({ where: { id } });
      if (!msg) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { starred: !msg.starred },
      });
      return NextResponse.json(updated);
    }

    if (action === 'read') {
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { status: 'READ' },
      });
      return NextResponse.json(updated);
    }

    if (action === 'archive') {
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return NextResponse.json(updated);
    }

    if (action === 'reply' && reply) {
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { adminReply: reply, repliedAt: new Date(), status: 'READ' },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Update message error:', error);
    return NextResponse.json({ error: 'Failed to update message.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.contactMessage.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json({ error: 'Failed to delete message.' }, { status: 500 });
  }
}
