// This route manages a single image within a room's gallery. Both the
// room id and the image id come from the URL (the [id] and [imageId]
// folder names). DELETE removes the image; PATCH sets it as the cover
// photo. Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// DELETE /api/admin/rooms/[id]/images/[imageId]
// Deletes the specified image, then re-numbers the remaining images'
// `order` field (0, 1, 2, ...) so there are no gaps left behind.
export async function DELETE(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Remove the image row itself.
    await prisma.roomImage.delete({ where: { id: params.imageId } });

    // Fetch whatever images are left for this room, in display order.
    const remaining = await prisma.roomImage.findMany({
      where: { roomId: params.id },
      orderBy: { order: 'asc' },
    });
    // Re-assign each remaining image's `order` to match its position in
    // the list (0, 1, 2, ...), closing any gap left by the deleted image.
    // Images already at the correct position are skipped (no-op update).
    await Promise.all(
      remaining.map((img, index) =>
        img.order === index ? null : prisma.roomImage.update({ where: { id: img.id }, data: { order: index } })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete room image error:', error);
    return NextResponse.json({ error: 'Failed to delete image.' }, { status: 500 });
  }
}

// PATCH /api/admin/rooms/[id]/images/[imageId]
// Sets the given image as the cover photo (order 0) by swapping it with whatever is currently first.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Look up the image we want to make the cover, and confirm it
    // actually belongs to the room in the URL (safety check).
    const target = await prisma.roomImage.findUnique({ where: { id: params.imageId } });
    if (!target || target.roomId !== params.id) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }

    // The current cover photo is whichever image has order === 0.
    const cover = await prisma.roomImage.findFirst({
      where: { roomId: params.id, order: 0 },
    });

    // If there's a different image currently at position 0, swap their
    // order values. $transaction runs both updates together so the data
    // never ends up in a half-swapped state if something fails midway.
    if (cover && cover.id !== target.id) {
      await prisma.$transaction([
        prisma.roomImage.update({ where: { id: cover.id }, data: { order: target.order } }),
        prisma.roomImage.update({ where: { id: target.id }, data: { order: 0 } }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set cover image error:', error);
    return NextResponse.json({ error: 'Failed to update image.' }, { status: 500 });
  }
}
