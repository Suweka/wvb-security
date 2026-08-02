// This route updates or deletes a single contact message, identified by
// its id in the URL (the [id] folder name). PATCH handles several actions
// (star/read/archive/reply); DELETE removes the message. Admin-only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// PATCH /api/admin/messages/[id]
// Performs one of several actions on a message based on body.action:
// 'star' (toggle starred), 'read' (mark read), 'archive' (mark archived),
// or 'reply' (save an admin reply and mark read). Returns the updated
// message, or 400 for an unrecognized action.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = params;
    const body = await req.json();
    const { action, reply } = body;

    if (action === 'star') {
      // Starring is a toggle, so we first read the current value...
      const msg = await prisma.contactMessage.findUnique({ where: { id } });
      if (!msg) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      // ...then flip it (starred -> not starred, or vice versa).
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { starred: !msg.starred },
      });
      return NextResponse.json(updated);
    }

    if (action === 'read') {
      // Mark this message as having been read by an admin.
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { status: 'READ' },
      });
      return NextResponse.json(updated);
    }

    if (action === 'archive') {
      // Move this message out of the active inbox view.
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return NextResponse.json(updated);
    }

    if (action === 'reply' && reply) {
      // Save the admin's reply text, timestamp it, and mark the message read.
      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { adminReply: reply, repliedAt: new Date(), status: 'READ' },
      });
      return NextResponse.json(updated);
    }

    // The action wasn't one of the recognized values above (or 'reply'
    // was sent without reply text).
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('Update message error:', error);
    return NextResponse.json({ error: 'Failed to update message.' }, { status: 500 });
  }
}

// DELETE /api/admin/messages/[id]
// Permanently deletes a contact message. Returns { success: true }.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Remove the matching row from the ContactMessage table entirely.
    await prisma.contactMessage.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete message error:', error);
    return NextResponse.json({ error: 'Failed to delete message.' }, { status: 500 });
  }
}
