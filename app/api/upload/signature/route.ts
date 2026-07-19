// Generates a signed upload request for Cloudinary (an image-hosting service), so
// the browser can upload a file (e.g. a bank transfer receipt) directly to
// Cloudinary without our server having to relay the file bytes itself. Exposes
// GET only.
import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

// Forces Node.js runtime — the Cloudinary SDK needs Node APIs.
export const runtime = 'nodejs';

// Only allow uploads into these known folders, so a client can't ask us to sign
// an upload into an arbitrary/unexpected location on our Cloudinary account.
const ALLOWED_FOLDERS = new Set(['bank-receipts', 'admin-avatars', 'room-images']);

// GET /api/upload/signature
// Optional query string ?folder=<name> (must be one of ALLOWED_FOLDERS, otherwise
// defaults to 'bank-receipts'). Returns a signature + timestamp + credentials the
// browser's Cloudinary upload widget uses to prove the upload was authorized by
// our server, without exposing our Cloudinary API secret to the browser.
export async function GET(request: NextRequest) {
  try {
    // request.nextUrl gives easy access to the parsed URL/query string on a NextRequest.
    const requested = request.nextUrl.searchParams.get('folder');
    const folder     = requested && ALLOWED_FOLDERS.has(requested) ? requested : 'bank-receipts';
    const timestamp  = Math.round(Date.now() / 1000);

    // Cloudinary's signing helper hashes the parameters together with our secret
    // API key — this signature lets the browser upload directly to Cloudinary
    // while proving the request was pre-approved by our server (the secret itself
    // never leaves the server).
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey:    process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    console.error('[upload/signature]', error);
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 500 });
  }
}
