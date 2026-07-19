// Validates a discount coupon code entered during checkout and, if it's usable,
// returns the discount percentage to apply. Exposes POST only. Does NOT mark the
// coupon as used/increment its usage count — that presumably happens elsewhere
// once the booking is actually completed.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/coupons/validate
// Expects JSON body { code }. Looks up the coupon (case-insensitive — code is
// upper-cased before the lookup) and checks it's active, within its valid date
// range, and hasn't hit its usage limit. Returns { success, discountPercent, code }
// on success, or an error message explaining why it's invalid.
export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    // Coupon codes are stored upper-case, so normalize the user's input to match.
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });
    }

    // isActive is a manual on/off switch admins can flip regardless of dates.
    if (!coupon.isActive) {
      return NextResponse.json({ error: 'This coupon is no longer active' }, { status: 400 });
    }

    // Check the coupon's valid date window (validFrom..validUntil).
    const now = new Date();
    if (now < coupon.validFrom) {
      return NextResponse.json({ error: 'This coupon is not yet valid' }, { status: 400 });
    }

    if (now > coupon.validUntil) {
      return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 });
    }

    // maxUsage is optional (null = unlimited); if set, block once usageCount reaches it.
    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 });
    }

    // All checks passed — tell the client how big a discount to apply.
    return NextResponse.json({
      success: true,
      discountPercent: coupon.discountPercent,
      code: coupon.code
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
