// Re-sends a fresh MFA code during the login step-2 window. Expects the
// same short-lived "adminMfaPending" cookie as verify-mfa. Rate-limited to
// one resend per 60 seconds per admin to prevent spamming the mailbox.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MFA_COOKIE_NAME, verifyMfaPendingToken, issueLoginCode } from '@/lib/admin-mfa';

const RESEND_COOLDOWN_MS = 60 * 1000;

// POST /api/auth/resend-mfa-code
export async function POST(request: NextRequest) {
  try {
    const pendingToken = request.cookies.get(MFA_COOKIE_NAME)?.value;
    const pending = pendingToken ? verifyMfaPendingToken(pendingToken) : null;
    if (!pending) {
      return NextResponse.json(
        { message: 'Your login session expired. Please log in again.' },
        { status: 401 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { id: pending.adminId } });
    if (!admin || !admin.isActive) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    const lastCode = await prisma.adminLoginCode.findFirst({
      where: { adminId: admin.id },
      orderBy: { createdAt: 'desc' },
    });
    if (lastCode && Date.now() - lastCode.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastCode.createdAt.getTime())) / 1000);
      return NextResponse.json(
        { message: `Please wait ${waitSeconds}s before requesting another code.` },
        { status: 429 }
      );
    }

    await issueLoginCode(admin);
    return NextResponse.json({ success: true, message: 'A new code has been sent.' });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
