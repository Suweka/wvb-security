// Manages the site-wide pricing settings singleton (currently just the
// foreign-pricing master switch, toggled from /admin/pricing). GET reads
// the current state; PUT updates it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit-log';

// GET /api/admin/pricing-settings
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const settings = await prisma.pricingSettings.findUnique({ where: { id: 'global' } });
    return NextResponse.json({ foreignPricingEnabled: settings?.foreignPricingEnabled ?? true });
  } catch (error) {
    console.error('Fetch pricing settings error:', error);
    return NextResponse.json({ error: 'Failed to load pricing settings.' }, { status: 500 });
  }
}

// PUT /api/admin/pricing-settings
// Expects { foreignPricingEnabled: boolean }.
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { foreignPricingEnabled } = await req.json();
    if (typeof foreignPricingEnabled !== 'boolean') {
      return NextResponse.json({ error: 'foreignPricingEnabled must be a boolean.' }, { status: 400 });
    }

    const settings = await prisma.pricingSettings.upsert({
      where: { id: 'global' },
      update: { foreignPricingEnabled },
      create: { id: 'global', foreignPricingEnabled },
    });

    await logAudit({
      actor: admin.email,
      action: 'PRICING_SETTINGS_SET',
      entityType: 'PricingSettings',
      entityId: 'global',
      metadata: { foreignPricingEnabled },
    });

    return NextResponse.json({ foreignPricingEnabled: settings.foreignPricingEnabled });
  } catch (error) {
    console.error('Set pricing settings error:', error);
    return NextResponse.json({ error: 'Failed to save pricing settings.' }, { status: 500 });
  }
}
