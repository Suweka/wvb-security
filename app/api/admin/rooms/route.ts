import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uniqueSlug } from '@/lib/slugify';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { name, description, price, maxGuests, size, beds, facilityIds } = await req.json();

    if (!name || price == null) {
      return NextResponse.json({ error: 'Name and price are required.' }, { status: 400 });
    }

    const slug = await uniqueSlug(name, async candidate => {
      const existing = await prisma.room.findUnique({ where: { slug: candidate } });
      return existing != null;
    });

    const room = await prisma.room.create({
      data: {
        name,
        slug,
        description: description || null,
        price,
        maxGuests: maxGuests != null ? Number(maxGuests) : undefined,
        size: size != null ? Number(size) : undefined,
        beds: beds || null,
        facilities: Array.isArray(facilityIds) && facilityIds.length
          ? { connect: facilityIds.map((id: string) => ({ id })) }
          : undefined,
      },
    });

    await logAudit({ actor: admin.email, action: 'ROOM_CREATE', entityType: 'Room', entityId: room.id, metadata: { name: room.name } });
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 });
  }
}
