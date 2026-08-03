// Public read-only endpoint returning the site-wide pricing settings
// (currently just the foreign-pricing master switch), used client-side (see
// CurrencyProvider) to decide whether to show the Local/Foreign switcher and
// what market to resolve prices in. No auth — this only reveals a boolean
// toggle, same trust level as any other published price on the site.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/pricing-settings
// Returns { foreignPricingEnabled: boolean }. Defaults to true if the
// settings row doesn't exist yet (nothing has ever changed the default).
export async function GET() {
  try {
    const settings = await prisma.pricingSettings.findUnique({ where: { id: 'global' } });
    return NextResponse.json({ foreignPricingEnabled: settings?.foreignPricingEnabled ?? true });
  } catch (error) {
    console.error('[GET /api/pricing-settings]', error);
    return NextResponse.json({ foreignPricingEnabled: true });
  }
}
