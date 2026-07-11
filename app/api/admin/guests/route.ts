import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, country } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required.' },
        { status: 400 }
      );
    }

    const guest = await prisma.guestCheckout.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone ?? '',
        country: country ?? null,
      },
    });

    return NextResponse.json({ success: true, guest }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create guest error:', error);
    const msg =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
        ? 'A guest with this email already exists.'
        : 'Failed to create guest.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
