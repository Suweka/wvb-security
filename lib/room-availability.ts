import type { Prisma } from '@prisma/client';

// Spread into a Room `where` clause to exclude rooms that currently have an
// unresolved MAINTENANCE task — i.e. rooms an admin has taken out of service.
export const excludeUnderMaintenance: Prisma.RoomWhereInput = {
  tasks: { none: { category: 'MAINTENANCE', status: { not: 'COMPLETED' } } },
};
