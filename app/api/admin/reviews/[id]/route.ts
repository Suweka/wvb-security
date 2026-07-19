// This route deletes a single guest review, identified by its id in the
// URL (the [id] folder name). Only DELETE is exposed, and only admins can
// call it.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

// DELETE /api/admin/reviews/[id]
// Permanently removes the review with this id. Returns { success: true }.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Delete the matching row from the Review table.
    await prisma.review.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json({ error: 'Failed to delete review.' }, { status: 500 });
  }
}
