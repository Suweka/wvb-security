const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROOMS = [
  {
    name:        'Deluxe Room',
    description: 'A spacious and elegantly furnished room with garden views, private bathroom, and all modern amenities.',
    price:       15000,
  },
  {
    name:        'Junior Suite',
    description: 'A beautifully appointed suite with a separate living area, premium furnishings, and stunning hillside views.',
    price:       22000,
  },
  {
    name:        'Family Room',
    description: 'Spacious family accommodation with two bedrooms, a shared living area, and a private terrace.',
    price:       28000,
  },
  {
    name:        'Premium Suite',
    description: 'Our most luxurious suite with a king-size bed, a private jacuzzi, and panoramic views of Nuwara Eliya.',
    price:       35000,
  },
];

async function main() {
  console.log('Seeding rooms...');
  for (const room of ROOMS) {
    const existing = await prisma.room.findFirst({
      where: { name: { equals: room.name, mode: 'insensitive' } },
    });
    if (existing) {
      console.log(`  ✓ Already exists: ${room.name}`);
    } else {
      await prisma.room.create({ data: room });
      console.log(`  + Created: ${room.name}`);
    }
  }
  const count = await prisma.room.count();
  console.log(`Done. ${count} rooms in database.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
