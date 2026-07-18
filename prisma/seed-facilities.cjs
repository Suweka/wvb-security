const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FACILITIES = [
  { label: 'Free WiFi',            icon: 'Wifi',           category: 'technology' },
  { label: 'Smart TV',             icon: 'Tv',              category: 'technology' },
  { label: 'AC',                   icon: 'Wind',            category: 'technology' },
  { label: 'Comfortable Bed',      icon: 'BedDouble',       category: 'room' },
  { label: 'Work Desk',            icon: 'Briefcase',       category: 'room' },
  { label: 'Wardrobe',             icon: 'Armchair',        category: 'room' },
  { label: 'Seating Area',         icon: 'Armchair',        category: 'room' },
  { label: 'Garden / Mountain View', icon: 'Trees',         category: 'room' },
  { label: 'Balcony',              icon: 'Sun',             category: 'room' },
  { label: 'Shower',               icon: 'ShowerHead',      category: 'bathroom' },
  { label: 'Hot Water',            icon: 'Bath',            category: 'bathroom' },
  { label: 'Hair Dryer',           icon: 'Sparkles',        category: 'bathroom' },
  { label: 'Premium Toiletries',   icon: 'Sparkles',        category: 'bathroom' },
  { label: 'In-House Chef',        icon: 'UtensilsCrossed', category: 'food' },
  { label: 'Coffee/Tea Maker',     icon: 'Coffee',          category: 'food' },
  { label: 'BBQ Grill Access',     icon: 'Flame',           category: 'food' },
  { label: 'Complimentary Breakfast', icon: 'UtensilsCrossed', category: 'food' },
  { label: 'Parking',              icon: 'ParkingCircle',   category: 'general' },
];

// Historical per-room facts + facility labels, carried over from the old hardcoded
// guest pages so the site doesn't go blank when they switch to DB-driven data.
const ROOM_DEFAULTS = {
  'Deluxe Room': {
    maxGuests: 2, size: 350, beds: '1 King Bed',
    facilities: ['Free WiFi', 'Hot Water', 'Smart TV', 'AC', 'Comfortable Bed', 'Work Desk', 'Wardrobe', 'Garden / Mountain View', 'Shower', 'Hair Dryer', 'Premium Toiletries', 'Coffee/Tea Maker'],
  },
  'Junior Suite': {
    maxGuests: 3, size: 450, beds: '1 King Bed + Sofa Bed',
    facilities: ['Free WiFi', 'Hot Water', 'Smart TV', 'AC', 'Comfortable Bed', 'Work Desk', 'Wardrobe', 'Seating Area', 'Garden / Mountain View', 'Shower', 'Hair Dryer', 'Premium Toiletries', 'Coffee/Tea Maker'],
  },
  'Family Room': {
    maxGuests: 4, size: 550, beds: '2 Queen Beds',
    facilities: ['Free WiFi', 'Hot Water', 'Smart TV', 'AC', 'Comfortable Bed', 'Wardrobe', 'Seating Area', 'Garden / Mountain View', 'Shower', 'Hair Dryer', 'Premium Toiletries', 'In-House Chef', 'Coffee/Tea Maker', 'Complimentary Breakfast'],
  },
  'Premium Suite': {
    maxGuests: 2, size: 600, beds: '1 King Bed',
    facilities: ['Free WiFi', 'Hot Water', 'Smart TV', 'AC', 'Comfortable Bed', 'Work Desk', 'Wardrobe', 'Seating Area', 'Garden / Mountain View', 'Balcony', 'Shower', 'Hair Dryer', 'Premium Toiletries', 'In-House Chef', 'Coffee/Tea Maker', 'BBQ Grill Access', 'Complimentary Breakfast'],
  },
};

async function main() {
  console.log('Seeding facility catalog...');
  const facilityByLabel = {};
  for (const f of FACILITIES) {
    const facility = await prisma.facility.upsert({
      where: { label: f.label },
      update: {},
      create: f,
    });
    facilityByLabel[f.label] = facility;
    console.log(`  + ${f.label}`);
  }

  console.log('Attaching historical facts/facilities to existing rooms...');
  for (const [name, defaults] of Object.entries(ROOM_DEFAULTS)) {
    const room = await prisma.room.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (!room) {
      console.log(`  ! No room found named "${name}", skipping`);
      continue;
    }
    await prisma.room.update({
      where: { id: room.id },
      data: {
        maxGuests: defaults.maxGuests,
        size: defaults.size,
        beds: defaults.beds,
        facilities: { set: defaults.facilities.map(label => ({ id: facilityByLabel[label].id })) },
      },
    });
    console.log(`  + ${name}`);
  }
  console.log('Done.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
