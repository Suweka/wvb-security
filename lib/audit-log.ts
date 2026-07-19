// Records a trail of "who did what" for admin actions (e.g. "admin X cancelled
// booking Y") into the AuditLog database table, for accountability/debugging.
// This is a side-effect-only logging helper — it never affects whether the
// original admin action succeeds or fails.
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Describes one audit entry: who did it (`actor`), what they did (`action`),
// optionally which kind of record and which specific record it affected
// (`entityType`/`entityId`), plus any extra context (`metadata`).
interface AuditLogParams {
  actor: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// Writes one row to the AuditLog table.
// Fire-and-forget: an audit log write failing must never break the actual request.
export async function logAudit({ actor, action, entityType, entityId, metadata }: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      // `metadata` is cast to Prisma's JSON input type since Prisma stores it
      // in a JSON column and needs that specific type, not a plain object.
      data: { actor, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  } catch (error) {
    // Deliberately swallow the error (just log it) rather than throwing/rejecting,
    // so a broken audit log can never block the real admin action from completing.
    console.error('[audit-log]', error);
  }
}

// Extracts the caller's IP address from the `x-forwarded-for` header (set by
// proxies/load balancers in front of the app). That header can contain a list
// of IPs (client, then each proxy hop); the first entry is the original client.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() ?? 'unknown';
}
