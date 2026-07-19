// This is the main NextAuth.js catch-all route. The folder name "[...nextauth]" is a
// Next.js "catch-all dynamic route" — it matches ANY path under /api/auth/ (e.g.
// /api/auth/signin, /api/auth/callback/google, /api/auth/session, /api/auth/csrf, etc.)
// and hands all of them off to the NextAuth library to handle. The actual providers
// (Google, credentials, etc.) and callbacks are configured in '@/lib/authOptions'.
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/authOptions'

// Ensure this route runs in Node (required for Prisma)
export const runtime = 'nodejs'

// NextAuth() builds a single request handler from our config (authOptions).
// We reuse that same handler for both GET requests (e.g. loading the sign-in page,
// fetching the current session) and POST requests (e.g. submitting credentials,
// signing out) — NextAuth internally figures out what to do based on the sub-path.
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
