// This route updates the status of a single concierge request, identified
// by its id in the URL (the [id] folder name). Only PATCH is exposed, and
// only admins can call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';

// PATCH /api/admin/concierge/[id]
// Transitions a concierge request's status based on an "action" in the
// JSON body ('start' | 'complete' | 'cancel'). Returns the updated
// request as { request }.
export async function PATCH(
  req: NextRequest,
  // `params.id` comes from the dynamic route segment "[id]" in the folder
  // name — Next.js fills it in with whatever value is in the URL, e.g.
  // /api/admin/concierge/abc123 -> params.id === "abc123".
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // The client tells us which action to perform on this request.
    const { action } = await req.json();
    const { id } = params;

    // Build up the fields to change based on which action was requested.
    const data: Record<string, unknown> = {};

    if (action === 'start') {
      // Mark the request as actively being worked on.
      data.status = 'IN_PROGRESS';
    } else if (action === 'complete') {
      // Mark the request done and record when it finished.
      data.status = 'COMPLETED';
      data.completedAt = new Date();
    } else if (action === 'cancel') {
      // Mark the request cancelled (no longer being actioned).
      data.status = 'CANCELLED';
    } else {
      // Any other action string is not a recognized status transition.
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    // Update the matching ConciergeRequest row with the new status fields.
    const request = await prisma.conciergeRequest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ request });
  } catch (error) {
    console.error('Concierge PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update request.' }, { status: 500 });
  }
}
