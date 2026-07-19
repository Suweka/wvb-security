// Verifies an admin JWT token (the one issued by app/api/auth/login/route.ts) and
// returns the decoded user info if it's valid. Used by the admin dashboard to check
// "am I still logged in?" without re-entering credentials. Exposes GET only.
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// GET /api/auth/verify
// Expects an "Authorization: Bearer <token>" header. Verifies the JWT's signature
// and expiry; if valid, returns the decoded payload (id, email, name, role).
// Returns 401 if the token is missing, invalid, or expired.
export async function GET(request: NextRequest) {
  try {
    // Pull the token out of the Authorization header, stripping the "Bearer " prefix.
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { message: 'Token not provided' },
        { status: 401 }
      );
    }

    // jwt.verify checks both the signature (was it signed with our secret?) and the
    // expiry time; it throws an error if either check fails, which is caught below.
    const decoded = jwt.verify(token, JWT_SECRET);
    return NextResponse.json({ user: decoded }, { status: 200 });
  } catch (error) {
    // Signature invalid, token expired, or malformed — treat all as "not authenticated".
    return NextResponse.json(
      { message: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
