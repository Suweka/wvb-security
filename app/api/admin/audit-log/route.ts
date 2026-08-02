// This route lets admins view the audit log — a history of actions taken
// in the admin dashboard (e.g. who changed what, and when). Only GET is
// exposed here (read-only), and only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/audit-log?action=...
// Fetches up to 200 most-recent audit log entries, optionally filtered by
// an "action" query param (e.g. ?action=DELETE_ROOM). Returns { entries }.
export async function GET(request: NextRequest) {
  // `request` is a NextRequest — Next.js's wrapper around the incoming
  // HTTP request, with helpers like `.nextUrl` for reading query params.
  // requireAdmin checks the request's session/cookie to confirm the
  // caller is a logged-in admin. If not, we reject with 401 Unauthorized.
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Read the optional "action" filter from the URL's query string.
    const action = request.nextUrl.searchParams.get('action');
    // Prisma is the ORM used to talk to the database. findMany() fetches
    // multiple rows: filter by action (if provided), newest first, and
    // cap the result at 200 rows so the response stays small.
    const entries = await prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // NextResponse.json() sends back a JSON HTTP response (status 200 by default).
    return NextResponse.json({ entries });
  } catch (error) {
    // Catches any unexpected failure (e.g. DB connection issue) and
    // returns a generic 500 Internal Server Error instead of crashing.
    console.error('[GET /api/admin/audit-log]', error);
    return NextResponse.json({ error: 'Failed to load audit log.' }, { status: 500 });
  }
}
