import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.roomImage.delete({ where: { id: params.imageId } });

    const remaining = await prisma.roomImage.findMany({
      where: { roomId: params.id },
      orderBy: { order: 'asc' },
    });
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

// Sets the given image as the cover photo (order 0) by swapping it with whatever is currently first.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const target = await prisma.roomImage.findUnique({ where: { id: params.imageId } });
    if (!target || target.roomId !== params.id) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }

    const cover = await prisma.roomImage.findFirst({
      where: { roomId: params.id, order: 0 },
    });

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
