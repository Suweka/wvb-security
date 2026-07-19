// Lets a signed-in guest leave a star rating + comment for a room they've actually
// stayed in, and rewards them with loyalty points for doing so. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

// POST /api/reviews
// Requires an active NextAuth session (the guest must be logged in). Expects JSON
// body { rating (1-5), comment?, roomId, bookingId }. Verifies the guest completed
// a confirmed, past stay in that room, blocks duplicate reviews, then creates the
// review and adds 25 loyalty points to the guest's account in a single transaction.
export async function POST(req: NextRequest) {
  // getServerSession reads the NextAuth session from the request's cookies —
  // this is how we know which (if any) user is currently logged in on the server side.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { rating, comment, roomId, bookingId } = await req.json();

  if (!rating || !roomId || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid review data.' }, { status: 400 });
  }

  const userId = session.user.id;

  // Verify the user actually has a completed confirmed booking for this room
  // (must belong to this user, be CONFIRMED, and have a checkOut date in the past)
  // — stops guests from reviewing rooms they never actually stayed in.
  const booking = await prisma.booking.findFirst({
    where: {
      id:       bookingId,
      userId,
      roomId,
      status:   'CONFIRMED',
      checkOut: { lt: new Date() },
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: 'You can only review rooms you have completed a stay in.' },
      { status: 403 }
    );
  }

  // Prevent duplicate reviews for the same room
  const existing = await prisma.review.findFirst({ where: { userId, roomId } });
  if (existing) {
    return NextResponse.json({ error: 'You have already reviewed this room.' }, { status: 409 });
  }

  // Create review and award 25 loyalty points in a transaction
  // A transaction runs both database operations as one atomic unit — either both
  // succeed together, or (if something fails) neither happens, so we never end up
  // with a review created but no points awarded, or vice versa.
  const [review] = await prisma.$transaction([
    prisma.review.create({
      data: { rating, comment: comment || null, userId, roomId },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { loyaltyPoints: { increment: 25 } },
    }),
  ]);

  return NextResponse.json(review, { status: 201 });
}
