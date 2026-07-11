import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
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
