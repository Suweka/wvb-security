// Creates new admin/manager accounts for the "Team" screen. Only ADMIN-role
// accounts may call this — a logged-in MANAGER is rejected even though
// they're a valid admin session, since they can't manage other admins.
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isSuperAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/admin/team
// Expects { name, email, password, role } in the JSON body. Returns the
// created admin (without its password hash) with a 201 status.
export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!isSuperAdmin(actor)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const { name, email, password, role } = await req.json();

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be between 2 and 100 characters.' }, { status: 400 });
    }
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Role must be ADMIN or MANAGER.' }, { status: 400 });
    }

    // findUnique on email is cheap and gives a friendlier error than
    // waiting for the DB's unique-constraint violation.
    const existing = await prisma.admin.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An admin with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.admin.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true, createdAt: true },
    });

    await logAudit({
      actor: actor!.email,
      action: 'ADMIN_CREATE',
      entityType: 'Admin',
      entityId: created.id,
      metadata: { email: created.email, role: created.role },
    });

    return NextResponse.json({ success: true, admin: created }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/team]', error);
    return NextResponse.json({ error: 'Failed to create admin.' }, { status: 500 });
  }
}
