// Handles submissions from the public "Contact Us" form, storing each message in
// the database so admins can review it later. Exposes POST only.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/contact
// Expects JSON body { firstName, email, phone?, subject, message }. Validates the
// required fields, saves a new ContactMessage row, and returns its id.
export async function POST(req: NextRequest) {
  try {
    const { firstName, email, phone, subject, message } = await req.json();

    // phone is optional; everything else is required.
    if (!firstName || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Save the message to the database for admins to view/respond to later.
    const contact = await prisma.contactMessage.create({
      data: { firstName, email, phone: phone || null, subject, message },
    });

    return NextResponse.json({ success: true, id: contact.id }, { status: 201 });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
