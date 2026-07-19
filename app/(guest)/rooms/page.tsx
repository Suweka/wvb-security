// This is the public "Browse All Rooms" page (/rooms). It's a Server Component that
// fetches the list of bookable rooms from the database with Prisma, reshapes the data,
// and hands it off to RoomsBrowser (a client component) which renders the filterable/
// sortable room grid and handles the interactive parts.
import { prisma } from '@/lib/prisma';
import { RoomsBrowser, type BrowsableRoom } from '@/components/guest/RoomsBrowser';
import { excludeUnderMaintenance } from '@/lib/room-availability';

// Always render fresh on each request rather than using a cached/static version,
// since room availability and pricing can change.
export const dynamic = 'force-dynamic';

export default async function RoomsPage() {
  // Fetch all rooms that have a slug (i.e. are publicly viewable) and aren't currently
  // under maintenance, along with their first image and a slimmed-down facility list,
  // sorted cheapest first.
  const rooms = await prisma.room.findMany({
    where: { slug: { not: null }, ...excludeUnderMaintenance },
    include: {
      images: { orderBy: { order: 'asc' }, take: 1 },
      facilities: { select: { label: true, icon: true } },
    },
    orderBy: { price: 'asc' },
  });

  // Convert the raw Prisma records into the plain shape RoomsBrowser expects — e.g.
  // turning the Decimal `price` into a plain number and picking just the first image URL.
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
