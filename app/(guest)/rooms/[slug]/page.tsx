// This is a dynamic route — the [slug] folder name means Next.js matches any URL like
// /rooms/deluxe-room or /rooms/junior-suite, capturing that last segment as params.slug.
// It's a Server Component that looks up the matching room in the database with Prisma,
// shapes the data for display, and renders it via RoomDetailClient (a client component
// that handles the interactive gallery/booking UI).
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { RoomDetailClient, type RoomDetailData } from '@/components/guest/RoomDetailClient';
import { excludeUnderMaintenance } from '@/lib/room-availability';

// Forces Next.js to render this page fresh on every request instead of caching a
// static version — important because room data (availability, maintenance status)
// can change and must always be up to date.
export const dynamic = 'force-dynamic';

// Maps the raw facility "category" values stored in the database to friendlier
// section headings shown on the page (e.g. 'room' -> 'Room Features').
const CATEGORY_LABELS: Record<string, string> = {
  room: 'Room Features',
  bathroom: 'Bathroom',
  technology: 'Technology',
  food: 'Dining & Kitchen',
  general: 'General',
};

// The display order for facility category sections (so "Room Features" always shows
// before "Bathroom", etc., regardless of the order they come back from the database).
const CATEGORY_ORDER = ['room', 'bathroom', 'technology', 'food', 'general'];

// `params.slug` is the dynamic URL segment captured by the [slug] folder — e.g. for
// /rooms/deluxe-room, params.slug is "deluxe-room". Next.js passes this in automatically.
export default async function RoomDetailsPage({ params }: { params: { slug: string } }) {
  // Look up the room by its slug, but only if it's not currently under maintenance
  // (excludeUnderMaintenance is a shared Prisma "where" filter from lib/room-availability).
  const room = await prisma.room.findFirst({
    where: { slug: params.slug, ...excludeUnderMaintenance },
    include: {
      images: { orderBy: { order: 'asc' } },
      facilities: true,
    },
  });

  // No matching room found (bad slug, or it's under maintenance) — render Next.js's
  // built-in 404 "not found" page instead of continuing.
  if (!room) {
    notFound();
  }

  // Group the room's flat list of facilities into buckets by category, e.g.
  // { room: ['Balcony', 'Air conditioning'], bathroom: ['Hot water'], ... }
  const groupsByCategory = new Map<string, string[]>();
  for (const facility of room.facilities) {
    const list = groupsByCategory.get(facility.category) ?? [];
    list.push(facility.label);
    groupsByCategory.set(facility.category, list);
  }

  // Turn the category map into an ordered array of { category, label, items } objects,
  // following CATEGORY_ORDER, and skipping any category the room has no facilities for.
  const facilityGroups = CATEGORY_ORDER
    .filter(category => groupsByCategory.has(category))
    .map(category => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      items: groupsByCategory.get(category) as string[],
    }));

  // Reshape the Prisma room record into the plain-object shape RoomDetailClient expects
  // (e.g. converting Prisma's Decimal price type to a plain number).
  const roomData: RoomDetailData = {
    slug: room.slug as string,
    name: room.name,
    price: Number(room.price),
    maxGuests: room.maxGuests,
    size: room.size,
    beds: room.beds || '',
    description: room.description || '',
    images: room.images.map(img => img.url),
    facilityGroups,
  };

  return <RoomDetailClient room={roomData} />;
}
