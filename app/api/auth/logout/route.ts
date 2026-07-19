// Logs the admin/manager out by clearing the "adminToken" cookie that was set
// during login (see app/api/auth/login/route.ts). Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/logout
// Takes no request body. Always succeeds — just deletes the auth cookie and
// returns a confirmation message.
export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: 'Logout successful' },
    { status: 200 }
  );

  // Removing the cookie invalidates the admin's session on this browser —
  // future requests won't carry a valid adminToken anymore.
  response.cookies.delete('adminToken');
  return response;
}
