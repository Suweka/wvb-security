// app/api/auth/send-otp/route.ts
// Generates a one-time password (OTP) for phone-based login and stores it in the
// database so it can later be checked by the "phone-otp" NextAuth provider
// (see lib/authOptions.ts) or app/api/auth/verify/route.ts. Exposes POST only.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Generate a random 6-digit OTP as a string, e.g. "004821".
// Math.random() * 900000 gives 0-899999, plus 100000 guarantees a 6-digit result
// (always between 100000 and 999999, never starting with a leading zero gap).
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth/send-otp
// Expects JSON body { phone }. Generates a fresh 6-digit code, invalidates any
// previous unused codes for that phone, saves the new one (valid for 10 minutes),
// and sends it via SMS (currently just logged to the console in development).
export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Invalidate previous unused OTPs for this phone
    // (so an old code can't still be used once a new one has been requested).
    await prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    })

    // Store new OTP in the database with its expiry time, to be checked later.
    await prisma.otpCode.create({
      data: { phone, code, expiresAt },
    })

    // Send SMS via your preferred provider
    // Option A: Twilio
    // await twilioClient.messages.create({
    //   body: `Your White Vintage Bungalow verification code is: ${code}. Valid for 10 minutes.`,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone,
    // })

    // Option B: Firebase SMS (handled client-side with reCAPTCHA)
    // Option C: For development — just log it
    console.log(`OTP for ${phone}: ${code}`)

    return NextResponse.json({ success: true, message: 'OTP sent successfully' })
  } catch (error) {
    // Catch-all so a DB error or bad JSON body doesn't crash the server.
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 })
  }
}