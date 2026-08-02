// Server Action that lists admin/manager accounts for the "Team" screen
// (app/admin/team). Mutations (create, role/name update, deactivate) go
// through app/api/admin/team/* instead — matching how every other "add"
// flow in this codebase (Guests, Rooms, ...) submits through an API route,
// while list views like this one are Server Actions (see getGuestsData in
// lib/admin-actions.ts for the same pattern).
'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminAction, isSuperAdmin } from '@/lib/admin-auth';

// Fetches every admin/manager account. Only ADMIN-role callers can see this —
// MANAGER-role admins get null (same as being logged out), same as the
// server-side gate in the API routes.
export async function getAdminsData() {
  const actor = await requireAdminAction();
  if (!isSuperAdmin(actor)) return null;
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    return admins.map((a) => ({
      ...a,
      role: a.role.toLowerCase() as 'admin' | 'manager',
      createdAt: a.createdAt.toISOString().split('T')[0],
      isSelf: a.id === actor!.id,
    }));
  } catch (error) {
    console.error('Error fetching admins:', error);
    return null;
  }
}
