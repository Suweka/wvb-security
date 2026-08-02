// Handles admin/manager login, step 1 of 2 (separate from the guest-facing
// NextAuth flow). Exposes POST only: verifies email + password against the
// Admin table, then — instead of signing a real session straight away —
// emails a 6-digit code and sets a short-lived "pending" cookie. The real
// "adminToken" session is only issued by app/api/auth/verify-mfa once that
// code is confirmed.
// NextRequest/NextResponse are Next.js's typed wrappers around the standard Web
// Request/Response objects, used in Route Handlers (API endpoints under app/api/).
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { logAudit, getClientIp } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { issueLoginCode, signMfaPendingToken, MFA_COOKIE_NAME } from '@/lib/admin-mfa';

// POST /api/auth/login
// Expects JSON body { email, password }. On success, emails a verification
// code and returns { mfaRequired: true } — no session token yet. On
// failure, returns 400/401 with a message.
export async function POST(request: NextRequest) {
  try {
    // Read and parse the JSON body sent by the client.
    const { email, password } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find admin user by email, then verify the password against its bcrypt hash.
    // Always run bcrypt.compare (even against a dummy hash) so a nonexistent email
    // doesn't respond faster than a wrong password — avoids leaking valid emails via timing.
    const admin = await prisma.admin.findUnique({ where: { email } });
    const DUMMY_HASH = '$2b$12$t9TznmjR4IkIf3Ovp2X9c.CThzVG8eVSI5wL17I5fKKLALBKal4oC';
    const isValid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

    // If no matching admin was found, the password didn't match, or the account has
    // been deactivated, reject the login (same generic message either way, so a
    // deactivated admin can't tell their account still exists) and record the
    // failed attempt in the audit log.
    if (!admin || !isValid || !admin.isActive) {
      await logAudit({
        actor: email,
        action: 'LOGIN_FAILED',
        entityType: 'Auth',
        metadata: { ip: getClientIp(request) },
      });
      return NextResponse.json(
        { message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Password check passed — email a 6-digit code and record that step.
    await issueLoginCode(admin);
    await logAudit({
      actor: admin.email,
      action: 'MFA_CODE_SENT',
      entityType: 'Auth',
      metadata: { ip: getClientIp(request) },
    });

    const pendingToken = signMfaPendingToken({ adminId: admin.id, email: admin.email, purpose: 'mfa' });

    const response = NextResponse.json(
      { mfaRequired: true, message: 'Verification code sent to your email.' },
      { status: 200 }
    );

    // Short-lived cookie that only proves "password verified, code pending" —
    // deliberately not the real "adminToken" session cookie.
    response.cookies.set(MFA_COOKIE_NAME, pendingToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    // Catch-all for unexpected errors (e.g. malformed JSON body, DB issues) so the
    // route never crashes the server — it always responds with a JSON error instead.
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
