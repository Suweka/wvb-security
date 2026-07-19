// Handles admin/manager login (separate from the guest-facing NextAuth flow).
// Exposes POST only: verifies email + password against a hardcoded admin list,
// then issues a JWT and sets it as an httpOnly cookie so the admin dashboard can
// authenticate future requests.
// NextRequest/NextResponse are Next.js's typed wrappers around the standard Web
// Request/Response objects, used in Route Handlers (API endpoints under app/api/).
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

// process.env.* reads an environment variable (a secret/config value set outside the
// code, e.g. in a .env file) — here it's the key used to sign/verify JWT tokens.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// POST /api/auth/login
// Expects JSON body { email, password }. On success, returns the admin's info + a JWT
// and sets an httpOnly "adminToken" cookie. On failure, returns 400/401 with a message.
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
    const admin = ADMIN_USERS.find((user) => user.email === email);
    const DUMMY_HASH = '$2b$12$t9TznmjR4IkIf3Ovp2X9c.CThzVG8eVSI5wL17I5fKKLALBKal4oC';
    const isValid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);

    // If no matching admin was found, or the password didn't match, reject the login
    // and record the failed attempt in the audit log.
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

    // Login succeeded — record it in the audit log too.
    await logAudit({
      actor: admin.email,
      action: 'LOGIN_SUCCESS',
      entityType: 'Auth',
      metadata: { ip: getClientIp(request) },
    });

    // Create a signed JWT (JSON Web Token) containing the admin's identity/role.
    // This token proves who the user is on future requests without needing to
    // look them up in a database every time — the server just verifies the signature.
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
    // Catch-all for unexpected errors (e.g. malformed JSON body, DB issues) so the
    // route never crashes the server — it always responds with a JSON error instead.
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
