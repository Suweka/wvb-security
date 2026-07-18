import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = request.cookies.get('adminToken')?.value ?? bearer;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}
