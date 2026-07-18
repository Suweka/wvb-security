import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { RoomDetailClient, type RoomDetailData } from '@/components/guest/RoomDetailClient';
import { excludeUnderMaintenance } from '@/lib/room-availability';

export const dynamic = 'force-dynamic';

const CATEGORY_LABELS: Record<string, string> = {
  room: 'Room Features',
  bathroom: 'Bathroom',
  technology: 'Technology',
  food: 'Dining & Kitchen',
  general: 'General',
};

const CATEGORY_ORDER = ['room', 'bathroom', 'technology', 'food', 'general'];

export default async function RoomDetailsPage({ params }: { params: { slug: string } }) {
  const room = await prisma.room.findFirst({
    where: { slug: params.slug, ...excludeUnderMaintenance },
    include: {
      images: { orderBy: { order: 'asc' } },
      facilities: true,
    },
  });

  if (!room) {
    notFound();
  }

  const groupsByCategory = new Map<string, string[]>();
  for (const facility of room.facilities) {
    const list = groupsByCategory.get(facility.category) ?? [];
    list.push(facility.label);
    groupsByCategory.set(facility.category, list);
  }

  const facilityGroups = CATEGORY_ORDER
    .filter(category => groupsByCategory.has(category))
    .map(category => ({
      category,
      label: CATEGORY_LABELS[category] || category,
      items: groupsByCategory.get(category) as string[],
    }));

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
