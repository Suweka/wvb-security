import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logAudit, getClientIp } from '@/lib/audit-log';

// Mock admin users database - Replace with a real database-backed Admin table.
// Passwords are bcrypt hashes (cost 12) of 'admin123' / 'manager123' — never store plaintext.
const ADMIN_USERS = [
  {
    id: 1,
    name: 'Jaylan Dorwart',
    email: 'admin@lodgify.com',
    passwordHash: '$2b$12$vMm1CGebMuL9x801YEKuju7/r05P6q6JtiPmqTojk8lLMbtcFkr3m',
    role: 'admin',
  },
  {
    id: 2,
    name: 'Manager User',
    email: 'manager@lodgify.com',
    passwordHash: '$2b$12$ZE3kG9/ODSDLSvIsDDKBbu/o5mbQGD9e.GF2FoeY8qPqeXRKe8xLm',
    role: 'manager',
  },
];

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
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
    const admin = ADMIN_USERS.find((user) => user.email === email);
    const DUMMY_HASH = '$2b$12$t9TznmjR4IkIf3Ovp2X9c.CThzVG8eVSI5wL17I5fKKLALBKal4oC';
    const isValid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

    if (!admin || !isValid) {
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

    await logAudit({
      actor: admin.email,
      action: 'LOGIN_SUCCESS',
      entityType: 'Auth',
      metadata: { ip: getClientIp(request) },
    });

    // Create JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return token and user info
    const response = NextResponse.json(
      {
        message: 'Login successful',
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
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

    return response;
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
