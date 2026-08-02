// One-time (but safe to rerun) seed: migrates the two admin accounts that
// used to be hardcoded in app/api/auth/login/route.ts into the real Admin
// table, keeping their existing bcrypt hashes so admin123/manager123 still
// work, and carries over the one avatar that used to live in AdminProfile.
// Run with: npx tsx prisma/seed-admins.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMINS = [
  {
    name: 'Jaylan Dorwart',
    // Kept as the Resend account's own verified email (not the property's
    // whitevintagebunglow@gmail.com) — Resend's sandbox mode only allows
    // sending to that address until a custom domain is verified, and this
    // account needs to actually receive its MFA login codes.
    email: 'suwekasansiluni@gmail.com',
    passwordHash: '$2b$12$vMm1CGebMuL9x801YEKuju7/r05P6q6JtiPmqTojk8lLMbtcFkr3m',
    role: 'ADMIN' as const,
    avatarUrl: 'https://res.cloudinary.com/dp0iqouk5/image/upload/v1784046191/admin-avatars/rdi3fl2p1zntsiwxtbxq.jpg',
  },
  {
    name: 'Manager User',
    email: 'manager@lodgify.com',
    passwordHash: '$2b$12$ZE3kG9/ODSDLSvIsDDKBbu/o5mbQGD9e.GF2FoeY8qPqeXRKe8xLm',
    role: 'MANAGER' as const,
    avatarUrl: null,
  },
];

async function main() {
  for (const admin of ADMINS) {
    await prisma.admin.upsert({
      where: { email: admin.email },
      update: {},
      create: admin,
    });
    console.log(`Seeded admin: ${admin.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
