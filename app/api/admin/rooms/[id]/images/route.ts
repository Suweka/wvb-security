import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { url, publicId } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'Image url is required.' }, { status: 400 });
    }

    const last = await prisma.roomImage.findFirst({
      where: { roomId: params.id },
      orderBy: { order: 'desc' },
    });

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
