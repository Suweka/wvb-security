// Lists all discount coupons and creates new ones. Only admins can call
// either endpoint. See app/api/admin/coupons/[id]/route.ts for updating
// (e.g. toggling active/inactive) or deleting a single coupon.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// GET /api/admin/coupons
// Returns every coupon, most recently created first.
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ coupons });
  } catch (error) {
    console.error('[GET /api/admin/coupons]', error);
    return NextResponse.json({ error: 'Failed to load coupons.' }, { status: 500 });
  }
}

// POST /api/admin/coupons
// Creates a new coupon. Expects { code, discountPercent, validFrom,
// validUntil, maxUsage? } in the JSON body. `code` is stored uppercase
// so lookups (in /api/coupons/validate) are case-insensitive in practice.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { code, discountPercent, validFrom, validUntil, maxUsage } = await request.json();

    if (!code?.trim() || !discountPercent || !validFrom || !validUntil) {
      return NextResponse.json({ error: 'Code, discount percent, and valid from/until dates are required.' }, { status: 400 });
    }
    const discount = Number(discountPercent);
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      return NextResponse.json({ error: 'Discount percent must be between 1 and 100.' }, { status: 400 });
    }
    const from = new Date(validFrom);
    const until = new Date(validUntil);
    if (until <= from) {
      return NextResponse.json({ error: '"Valid until" must be after "valid from".' }, { status: 400 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        discountPercent: discount,
        validFrom: from,
        validUntil: until,
        maxUsage: maxUsage ? Number(maxUsage) : null,
      },
    });
    await logAudit({ actor: admin.email, action: 'COUPON_CREATE', entityType: 'Coupon', entityId: coupon.id, metadata: { code: coupon.code, discountPercent: coupon.discountPercent } });
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error: any) {
    // Prisma throws a unique-constraint error (code P2002) if this code already exists.
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A coupon with this code already exists.' }, { status: 409 });
    }
    console.error('[POST /api/admin/coupons]', error);
    return NextResponse.json({ error: 'Failed to create coupon.' }, { status: 500 });
  }
}
