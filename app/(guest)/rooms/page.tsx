import { prisma } from '@/lib/prisma';
import { RoomsBrowser, type BrowsableRoom } from '@/components/guest/RoomsBrowser';
import { excludeUnderMaintenance } from '@/lib/room-availability';

export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  const rooms = await prisma.room.findMany({
    where: { slug: { not: null }, ...excludeUnderMaintenance },
    include: {
      images: { orderBy: { order: 'asc' }, take: 1 },
      facilities: { select: { label: true, icon: true } },
    },
    orderBy: { price: 'asc' },
  });

  const browsableRooms: BrowsableRoom[] = rooms.map(r => ({
    id: r.slug as string,
    name: r.name,
    description: r.description || '',
    price: Number(r.price),
    maxGuests: r.maxGuests,
    size: r.size,
    image: r.images[0]?.url ?? null,
    amenities: r.facilities.map(f => ({ label: f.label, icon: f.icon })),
  }));

  return <RoomsBrowser rooms={browsableRooms} />;
}
