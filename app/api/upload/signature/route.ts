import { NextRequest, NextResponse } from 'next/server';
import cloudinary from '@/lib/cloudinary';

export const runtime = 'nodejs';

const ALLOWED_FOLDERS = new Set(['bank-receipts', 'admin-avatars', 'room-images']);

export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get('folder');
    const folder     = requested && ALLOWED_FOLDERS.has(requested) ? requested : 'bank-receipts';
    const timestamp  = Math.round(Date.now() / 1000);

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
