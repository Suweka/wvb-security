// This is the server-side entry point for the /profile route. It's a Server Component
// (async function, no 'use client') that runs on the server: it checks the guest is
// logged in, fetches their full profile data (bookings, payments, reviews) straight
// from the database with Prisma, and then hands that data to ProfileClient to render
// the interactive dashboard.
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import ProfileClient from './ProfileClient'

// Fetches one user's full profile record from the database, including their
// bookings (with room/payment/receipt details), saved payment methods, and reviews.
async function getUserData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      bookings: {
        include: { room: true, payment: true, bankTransferReceipt: true, refundRequest: true },
        orderBy: { createdAt: 'desc' },
      },
      savedPayments: true,
      reviews: true,
    },
  })
}

// Server Components can be `async` — Next.js waits for this function to finish
// (including any awaited database calls) before rendering the page's HTML.
export default async function ProfilePage() {
  // Check if the visitor has an active login session (server-side auth check).
  const session = await getServerSession(authOptions)

  // Not logged in — send them to the login page, remembering to bring them back here after.
  if (!session) {
    redirect('/login?callbackUrl=/profile')
  }

  const user = await getUserData(session.user.id)

  // Edge case: valid session but the user record is missing (e.g. deleted account).
  if (!user) redirect('/login')

  return <ProfileClient user={user} />
}