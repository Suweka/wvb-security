// Server-side helper for verifying that an incoming request is from a logged-in
// admin. Used inside /api/admin/* route handlers to check the JWT before
// letting a request through — this is the actual security gate, separate from
// lib/auth.ts (which only stores UI-display info in the browser).
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers'; // reads cookies from the current request when there's no NextRequest object to hand in (e.g. inside Server Actions)
import jwt from 'jsonwebtoken'; // library for creating/verifying JSON Web Tokens
import { prisma } from '@/lib/prisma';

// Secret key used to sign/verify admin JWTs. Should always come from the
// JWT_SECRET environment variable in production — the hardcoded fallback here
// is only so local dev doesn't crash if the env var is missing.
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Shape of the data encoded inside a valid admin JWT.
export interface AdminTokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Re-checks the JWT's subject against the Admin table so a deactivated admin
// loses access immediately (within the request), rather than only at their
// next login once the (up to 24h) token would otherwise expire.
async function verifyStillActive(payload: AdminTokenPayload): Promise<AdminTokenPayload | null> {
  const admin = await prisma.admin.findUnique({
    where: { id: payload.id },
    select: { isActive: true },
  });
  if (!admin || !admin.isActive) return null;
  return payload;
}

// Verifies the admin JWT from the httpOnly `adminToken` cookie (falls back to an
// Authorization: Bearer header for non-browser callers). Returns null if missing/invalid,
// expired, or the admin has since been deactivated — callers must treat that as 401,
// this does not throw.
export async function requireAdmin(request: NextRequest): Promise<AdminTokenPayload | null> {
  // Strip the "Bearer " prefix (case-insensitive) from the Authorization header, if present.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  // Prefer the httpOnly cookie (normal browser flow); fall back to the header for API/script callers.
  const token = request.cookies.get('adminToken')?.value ?? bearer;
  if (!token) return null;

  try {
    // jwt.verify checks the token's signature and expiry against JWT_SECRET.
    // If valid, it returns the decoded payload; otherwise it throws.
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    return await verifyStillActive(payload);
  } catch {
    // Any failure (expired, tampered, wrong secret, malformed) is treated the
    // same way: not authenticated.
    return null;
  }
}

// Same check as requireAdmin, but for use inside Server Actions
// ('use server' functions, like everything in lib/admin-actions.ts). Server
// Actions don't receive a NextRequest to read cookies from — Next.js's
// cookies() helper reads the httpOnly adminToken cookie from the current
// request context automatically instead. Never throws; returns null for any
// missing/invalid/expired/deactivated token, same as requireAdmin.
export async function requireAdminAction(): Promise<AdminTokenPayload | null> {
  const token = cookies().get('adminToken')?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    return await verifyStillActive(payload);
  } catch {
    return null;
  }
}

// Extra gate for the Team screen (lib/admin-management.ts): only ADMIN-role
// accounts may view or manage other admins, even though MANAGER-role admins
// pass requireAdmin/requireAdminAction just fine everywhere else. Payload
// role is lowercased (see app/api/auth/login/route.ts), so compare that way.
export function isSuperAdmin(admin: AdminTokenPayload | null): boolean {
  return admin?.role === 'admin';
}
