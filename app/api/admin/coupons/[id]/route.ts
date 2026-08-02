// Updates or deletes a single coupon, identified by its id in the URL
// (the [id] folder name). Both require an admin session.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// PATCH /api/admin/coupons/[id]
// Partially updates a coupon. Any of { discountPercent, validFrom,
// validUntil, maxUsage, isActive } may be included — only the fields
// actually provided are changed. Used for both full edits and the quick
// "toggle active" switch on the coupons list.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { discountPercent, validFrom, validUntil, maxUsage, isActive } = await req.json();

    const data: Record<string, unknown> = {};
    if (discountPercent !== undefined) data.discountPercent = Number(discountPercent);
    if (validFrom !== undefined) data.validFrom = new Date(validFrom);
    if (validUntil !== undefined) data.validUntil = new Date(validUntil);
    if (maxUsage !== undefined) data.maxUsage = maxUsage === null || maxUsage === '' ? null : Number(maxUsage);
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const coupon = await prisma.coupon.update({ where: { id: params.id }, data });
    await logAudit({ actor: admin.email, action: 'COUPON_UPDATE', entityType: 'Coupon', entityId: coupon.id, metadata: { changes: data } });
    return NextResponse.json({ coupon });
  } catch (error) {
    console.error('[PATCH /api/admin/coupons/[id]]', error);
    return NextResponse.json({ error: 'Failed to update coupon.' }, { status: 500 });
  }
}

// DELETE /api/admin/coupons/[id]
// Permanently deletes a coupon.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.coupon.delete({ where: { id: params.id } });
    await logAudit({ actor: admin.email, action: 'COUPON_DELETE', entityType: 'Coupon', entityId: params.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/coupons/[id]]', error);
    return NextResponse.json({ error: 'Failed to delete coupon.' }, { status: 500 });
  }
}
