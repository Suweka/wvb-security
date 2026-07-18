import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { excludeUnderMaintenance } from '@/lib/room-availability';

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      where: { slug: { not: null }, ...excludeUnderMaintenance },
      include: { images: { orderBy: { order: 'asc' }, take: 1 } },
      orderBy: { price: 'asc' },
    });

    const shaped = rooms.map(r => ({
      id: r.slug,
      name: r.name,
      price: Number(r.price),
      maxGuests: r.maxGuests,
      image: r.images[0]?.url ?? null,
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error('[GET /api/rooms]', error);
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 });
  }
}
