// Shared helpers for the admin login MFA step (see app/api/auth/login,
// app/api/auth/verify-mfa, app/api/auth/resend-mfa-code): generating/sending
// a fresh email code, and signing/verifying the short-lived "pending" JWT
// that bridges password-verified to code-verified. Kept separate from
// lib/admin-auth.ts, which only ever deals with real (post-MFA) sessions.
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { sendAdminLoginCodeEmail } from '@/lib/email';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Cookie name for the pending-MFA token — deliberately different from
// "adminToken" so requireAdmin/requireAdminAction can never mistake a
// mid-login state for a real session.
export const MFA_COOKIE_NAME = 'adminMfaPending';

export interface MfaPendingPayload {
  adminId: string;
  email: string;
  purpose: 'mfa';
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Invalidates any previous unused code for this admin, creates a fresh one
// (valid for 10 minutes), and emails it. Shared by the initial login step
// and the "resend code" endpoint.
export async function issueLoginCode(admin: { id: string; email: string; name: string }): Promise<void> {
  await prisma.adminLoginCode.updateMany({
    where: { adminId: admin.id, used: false },
    data: { used: true },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.adminLoginCode.create({ data: { adminId: admin.id, code, expiresAt } });

  // Always logged (like the phone-OTP flow in app/api/auth/send-otp does)
  // so the code is still visible in the server console if the real send
  // fails — e.g. Resend's sandbox only allows sending to its own verified
  // address until a custom domain is set up.
  console.log(`[MFA] Login code for ${admin.email}: ${code}`);
  await sendAdminLoginCodeEmail({ to: admin.email, name: admin.name, code });
}

export function signMfaPendingToken(payload: MfaPendingPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

// Verifies the pending-MFA JWT's signature, expiry, and purpose flag.
// Returns null (never throws) for anything invalid.
export function verifyMfaPendingToken(token: string): MfaPendingPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MfaPendingPayload;
    return decoded.purpose === 'mfa' ? decoded : null;
  } catch {
    return null;
  }
}
