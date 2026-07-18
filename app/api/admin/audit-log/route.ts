import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const action = request.nextUrl.searchParams.get('action');
    const entries = await prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[GET /api/admin/audit-log]', error);
    return NextResponse.json({ error: 'Failed to load audit log.' }, { status: 500 });
  }
}
