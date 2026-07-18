import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface AuditLogParams {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget: an audit log write failing must never break the actual request.
export async function logAudit({ actor, action, entityType, entityId, metadata }: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { actor, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  } catch (error) {
    console.error('[audit-log]', error);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() ?? 'unknown';
}
