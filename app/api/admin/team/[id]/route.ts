// Updates a single admin/manager account: name/role changes and the
// deactivate/reactivate (soft-delete) action. ADMIN-role only. Deactivation
// is what actually removes access — requireAdmin/requireAdminAction re-check
// isActive against the DB on every request, so it takes effect immediately
// rather than waiting for the admin's token to expire.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isSuperAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// How many *other* active ADMIN-role accounts exist besides `excludeId` —
// used to block removing the last super-admin via deactivation or demotion.
async function otherActiveAdminCount(excludeId: string) {
  return prisma.admin.count({
    where: { role: 'ADMIN', isActive: true, id: { not: excludeId } },
  });
}

// PATCH /api/admin/team/[id]
// Expects a partial body: { name?, role?, isActive? } — only included
// fields are changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await requireAdmin(req);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const { name, role, isActive } = await req.json();
    const target = await prisma.admin.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: 'Admin not found.' }, { status: 404 });
    }

    const data: { name?: string; role?: 'ADMIN' | 'MANAGER'; isActive?: boolean } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return NextResponse.json({ error: 'Name must be between 2 and 100 characters.' }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (role !== undefined) {
      if (role !== 'ADMIN' && role !== 'MANAGER') {
        return NextResponse.json({ error: 'Role must be ADMIN or MANAGER.' }, { status: 400 });
      }
      // Guard against demoting the only remaining super-admin — the system
      // must always keep at least one account that can manage the team.
      if (target.role === 'ADMIN' && role === 'MANAGER' && (await otherActiveAdminCount(target.id)) === 0) {
        return NextResponse.json({ error: 'Cannot demote the last remaining admin.' }, { status: 400 });
      }
      data.role = role;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean.' }, { status: 400 });
      }
      if (!isActive) {
        // Self-lockout guard: an admin can't deactivate the account they're
        // currently logged in as.
        if (target.id === actor!.id) {
          return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
        }
        // Same "last admin standing" guard as demotion, above.
        if (target.role === 'ADMIN' && (await otherActiveAdminCount(target.id)) === 0) {
          return NextResponse.json({ error: 'Cannot deactivate the last remaining admin.' }, { status: 400 });
        }
      }
      data.isActive = isActive;
    }

    const updated = await prisma.admin.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true, createdAt: true },
    });

    await logAudit({
      actor: actor!.email,
      action: isActive === false ? 'ADMIN_DEACTIVATE' : isActive === true ? 'ADMIN_REACTIVATE' : 'ADMIN_UPDATE',
      entityType: 'Admin',
      entityId: updated.id,
      metadata: { email: updated.email, role: updated.role, isActive: updated.isActive },
    });

    return NextResponse.json({ success: true, admin: updated });
  } catch (error) {
    console.error('[PATCH /api/admin/team/[id]]', error);
    return NextResponse.json({ error: 'Failed to update admin.' }, { status: 500 });
  }
}
