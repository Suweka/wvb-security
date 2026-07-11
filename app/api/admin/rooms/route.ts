import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { name, description, price } = await req.json();

    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required.' }, { status: 400 });
    }

    const room = await prisma.room.create({
      data: { name, description: description || null, price },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 });
  }
}
