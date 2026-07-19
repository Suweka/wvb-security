// Prisma client singleton — prevents creating a new DB connection on every
// hot-reload in dev. Every other file should import `prisma` from here rather
// than doing `new PrismaClient()` itself.
import { PrismaClient } from '@prisma/client';

// In dev, Next.js hot-reloads modules on every file save, which would normally
// re-run this file and create a brand-new PrismaClient (and DB connection)
// each time — quickly exhausting available connections. Stashing the client on
// the `global` object lets it survive across hot reloads.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Reuse the existing client if one was already created (dev hot-reload case),
// otherwise create a fresh one. `log` makes Prisma print queries/errors/warnings
// to the console, which is handy while developing.
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

// Only cache on `global` outside production — in production each server
// instance should just create one client normally at startup.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
