// Handles admin/manager login, step 2 of 2. Expects the short-lived
// "adminMfaPending" cookie set by app/api/auth/login and a { code } body.
// On a correct, unexpired code it issues the real "adminToken" session
// cookie exactly like the old single-step login used to.
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { logAudit, getClientIp } from '@/lib/audit-log';
import { prisma } from '@/lib/prisma';
import { MFA_COOKIE_NAME, verifyMfaPendingToken } from '@/lib/admin-mfa';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MAX_ATTEMPTS = 5;

// POST /api/auth/verify-mfa
// Expects JSON body { code }. On success, returns the same
// { message, token, user } shape the old single-step login used to, and
// sets the real "adminToken" cookie.
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

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ message: 'Verification code is required' }, { status: 400 });
    }

    // The most recent unused, unexpired code for this admin.
    const loginCode = await prisma.adminLoginCode.findFirst({
      where: { adminId: pending.adminId, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!loginCode) {
      return NextResponse.json(
        { message: 'That code has expired. Request a new one.' },
        { status: 400 }
      );
    }

    if (loginCode.code !== code) {
      const attempts = loginCode.attempts + 1;
      // Burn the code after too many wrong guesses so it can't be brute-forced.
      await prisma.adminLoginCode.update({
        where: { id: loginCode.id },
        data: { attempts, used: attempts >= MAX_ATTEMPTS },
      });
      await logAudit({
        actor: pending.email,
        action: 'MFA_FAILED',
        entityType: 'Auth',
        metadata: { ip: getClientIp(request), attempts },
      });
      const message = attempts >= MAX_ATTEMPTS
        ? 'Too many incorrect attempts. Please log in again.'
        : 'Incorrect code. Please try again.';
      return NextResponse.json({ message }, { status: 400 });
    }

    // Correct code — re-check the admin still exists and is active (in case
    // they were deactivated while this login was in progress), same guard
    // as the password step.
    const admin = await prisma.admin.findUnique({ where: { id: pending.adminId } });
    if (!admin || !admin.isActive) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    await prisma.adminLoginCode.update({ where: { id: loginCode.id }, data: { used: true } });
    await logAudit({
      actor: admin.email,
      action: 'MFA_SUCCESS',
      entityType: 'Auth',
      metadata: { ip: getClientIp(request) },
    });

    // Role is lowercased here to match what the admin UI has always displayed/compared
    // against ('admin'/'manager'), even though it's stored as an uppercase enum in the DB.
    const role = admin.role.toLowerCase();
    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const response = NextResponse.json(
      {
        message: 'Login successful',
        token,
        user: { id: admin.id, name: admin.name, email: admin.email, role },
      },
      { status: 200 }
    );

    // httpOnly cookie is the actual auth mechanism admin API routes check —
    // not readable by JS, so it can't be stolen via an XSS payload.
    response.cookies.set('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/',
    });
    // The pending-MFA cookie has done its job — clear it.
    response.cookies.delete(MFA_COOKIE_NAME);

    return response;
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
