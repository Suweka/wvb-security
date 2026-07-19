// Server-side helper for verifying that an incoming request is from a logged-in
// admin. Used inside /api/admin/* route handlers to check the JWT before
// letting a request through — this is the actual security gate, separate from
// lib/auth.ts (which only stores UI-display info in the browser).
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken'; // library for creating/verifying JSON Web Tokens

// Secret key used to sign/verify admin JWTs. Should always come from the
// JWT_SECRET environment variable in production — the hardcoded fallback here
// is only so local dev doesn't crash if the env var is missing.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Shape of the data encoded inside a valid admin JWT.
export interface AdminTokenPayload {
  id: number;
  email: string;
  name: string;
  role: string;
}

// Verifies the admin JWT from the httpOnly `adminToken` cookie (falls back to an
// Authorization: Bearer header for non-browser callers). Returns null if missing/invalid —
// callers must treat that as 401, this does not throw.
export function requireAdmin(request: NextRequest): AdminTokenPayload | null {
  // Strip the "Bearer " prefix (case-insensitive) from the Authorization header, if present.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  // Prefer the httpOnly cookie (normal browser flow); fall back to the header for API/script callers.
  const token = request.cookies.get('adminToken')?.value ?? bearer;
  if (!token) return null;

  try {
    // jwt.verify checks the token's signature and expiry against JWT_SECRET.
    // If valid, it returns the decoded payload; otherwise it throws.
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    // Any failure (expired, tampered, wrong secret, malformed) is treated the
    // same way: not authenticated.
    return null;
  }
}
