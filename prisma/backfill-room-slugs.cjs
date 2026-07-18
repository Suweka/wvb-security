const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Backfilling room slugs...');
  const rooms = await prisma.room.findMany({ where: { slug: null } });
  const existingSlugs = new Set(
    (await prisma.room.findMany({ where: { slug: { not: null } }, select: { slug: true } })).map(r => r.slug)
  );

  for (const room of rooms) {
    const base = slugify(room.name) || 'room';
    let candidate = base;
    let suffix = 2;
    while (existingSlugs.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix++;
    }
    existingSlugs.add(candidate);
    await prisma.room.update({ where: { id: room.id }, data: { slug: candidate } });
    console.log(`  + ${room.name} -> ${candidate}`);
  }
  console.log(`Done. ${rooms.length} room(s) updated.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
