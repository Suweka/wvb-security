import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, description, price } = await req.json();

    const data: Record<string, unknown> = {};
    if (name  !== undefined) data.name        = name;
    if (description !== undefined) data.description = description || null;
    if (price !== undefined) data.price       = price;

    const room = await prisma.room.update({ where: { id: params.id }, data });
    return NextResponse.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json({ error: 'Failed to update room.' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.room.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete room error:', error);
    return NextResponse.json({ error: 'Failed to delete room. It may have associated bookings.' }, { status: 500 });
  }
}
