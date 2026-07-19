// This route adds a new photo to a room's image gallery. The room is
// identified by its id in the URL (the [id] folder name). Only POST is
// exposed, and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// POST /api/admin/rooms/[id]/images
// Expects { url, publicId? } in the JSON body (the image has already
// been uploaded elsewhere, e.g. to Cloudinary — this just records it).
// Appends the image to the end of this room's gallery order. Returns the
// created image row with a 201 status.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { url, publicId } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'Image url is required.' }, { status: 400 });
    }

    // Find the current last image (highest `order` value) for this room
    // so the new image can be placed right after it.
    const last = await prisma.roomImage.findFirst({
      where: { roomId: params.id },
      orderBy: { order: 'desc' },
    });

    // Insert the new image row. If there's no existing image, this is
    // the first one, so its order is 0; otherwise it goes one past the
    // current last image.
    const image = await prisma.roomImage.create({
      data: {
        roomId: params.id,
        url,
        publicId: publicId || null,
        order: last ? last.order + 1 : 0,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error('Add room image error:', error);
    return NextResponse.json({ error: 'Failed to add image.' }, { status: 500 });
  }
}
