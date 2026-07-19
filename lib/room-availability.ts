// Server-side helper for filtering out rooms that shouldn't be shown as
// available — currently just rooms with an open maintenance task. (Booking
// date-overlap checks against existing reservations, if any, are handled
// elsewhere in the codebase; this file only covers the maintenance-status filter.)
import type { Prisma } from '@prisma/client';

// Spread into a Room `where` clause to exclude rooms that currently have an
// unresolved MAINTENANCE task — i.e. rooms an admin has taken out of service.
// `tasks: { none: {...} }` means "true only if NO task on this room matches
// the given condition" (a Prisma relation filter), so a room is excluded as
// soon as it has at least one MAINTENANCE task that isn't COMPLETED yet.
export const excludeUnderMaintenance: Prisma.RoomWhereInput = {
  tasks: { none: { category: 'MAINTENANCE', status: { not: 'COMPLETED' } } },
};
