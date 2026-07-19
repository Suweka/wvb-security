// app/api/auth/register/route.ts
// Creates a new guest account (email/password sign-up). Exposes POST only —
// this is separate from the NextAuth flow, used by the site's own registration form.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST /api/auth/register
// Expects JSON body { name, email, phone, password }. Creates a new User row
// (with a starting bonus of 100 loyalty points) and returns basic user info.
// Fails with 400 if input is invalid, 409 if the email is already taken.
export async function POST(request: Request) {
  try {
    const { name, email, phone, password } = await request.json()

    // Basic validation: require an email and a password of at least 8 characters.
    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Check whether a user with this email already exists — emails must be unique.
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Never store plaintext passwords — hash it with bcrypt (cost factor 12) first.
    const hashed = await bcrypt.hash(password, 12)
    // Create the new user record. `select` limits the returned fields so the
    // password hash never gets sent back to the client.
    const user = await prisma.user.create({
      data: { name, email, phone, password: hashed, loyaltyPoints: 100 },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json(user)
  } catch {
    // Any unexpected failure (e.g. DB error) falls through to a generic 500 response.
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}