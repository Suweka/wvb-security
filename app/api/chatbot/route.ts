// Powers the site's AI chat widget. Exposes POST only: takes the conversation so
// far, builds a system prompt describing the property (facts + live room/pricing
// data pulled from the database), sends it to Google's Gemini API, and returns the
// assistant's reply.
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Forces this route to run in the Node.js runtime (rather than the lighter-weight
// Edge runtime) — needed here because Prisma (our database client) requires Node.
export const runtime = 'nodejs';

// Environment variable holding the Gemini API key (kept secret, set in .env — never
// committed to source control). GEMINI_URL is the endpoint we POST prompts to.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const MAX_HISTORY = 12; // most recent messages to send, keeps requests small

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Builds the "system prompt" — instructions given to the AI before the user's
// actual messages, describing who it is, what it knows, and how it should behave.
// Room names/prices are fetched fresh from the database each time so the chatbot
// never quotes stale pricing.
async function buildSystemPrompt(): Promise<string> {
  // Fetch all rooms (name, description, price, capacity, beds), cheapest first,
  // to include live pricing info in the prompt.
  const rooms = await prisma.room.findMany({
    select: { name: true, description: true, price: true, maxGuests: true, beds: true },
    orderBy: { price: 'asc' },
  });

  // Format each room into a single readable bullet-point line for the prompt text.
  const roomLines = rooms
    .map(r => `- ${r.name}: LKR ${Number(r.price).toLocaleString()}/night, sleeps up to ${r.maxGuests} guest(s)${r.beds ? `, ${r.beds}` : ''}${r.description ? ` — ${r.description}` : ''}`)
    .join('\n');

  return `You are the friendly virtual concierge for White Vintage Bungalow, a boutique family-run guest bungalow in Nuwara Eliya, Sri Lanka's hill country.

FACTS ABOUT THE PROPERTY (use these, don't invent details):
- Location: Nuwara Eliya, Sri Lanka's tea-country hill region. Full address: 78/5 Bakers Park, 18 Dawson Hills, Nuwara Eliya. Google Maps link (share this whenever a guest asks where the property is or how to find it): https://www.google.com/maps/search/78%2F5+Bakers+Park,+Dawson+Hills,+Nuwara+Eliya/@6.942114,80.793866,15z
- Character: vintage white facades, cosy interiors, lush private garden, family-run, 10+ years of hospitality, 500+ happy guests, 4.9 Google rating.
- Amenities: in-house chef with home-style meals (breakfast included), free WiFi, garden space, 24-hour hot water, living/dining rooms, BBQ grill, Bluetooth mic & speakers, mountain/tea-plantation views, TV in every room, airport transfers & tour arrangements (from LKR 8,000), laundry service (from LKR 500), 24/7 concierge assistance.
- Check-in: 2:00 PM. Check-out: 11:00 AM. Early check-in / late check-out available on request, subject to availability, with extra charges (late check-out after 3:00 PM incurs a half-day charge).
- Valid government photo ID required at check-in (passport, national ID, or driver's license); international guests need passport + visa details.
- Deposit: 30% required at booking to confirm a reservation; remaining balance payable on arrival or checkout.
- Cancellation policy: more than 24 hours before check-in = full refund; within 24 hours of check-in = one night's charge applies, remainder refunded; no-show = full amount charged, no refund. Bookings can be modified up to 48 hours before check-in, subject to availability.
- Refund timing: online card payments (PayHere) refunded in 7–14 business days; bank transfers in 5–7 business days after verification.
- Contact: phone/WhatsApp +94 777 180 599, email whitevintagebunglow@gmail.com. Business hours for cancellation requests: 8:00 AM–6:00 PM, Monday to Sunday, Sri Lanka time.
- Booking: guests book directly through this website at /booking, or /rooms to browse rooms first. Reservations line (landline): +94 52 222 5232, in addition to the WhatsApp number above.

POLICIES & OTHER COMMON QUESTIONS:
- Pets: not allowed, with the exception of registered service animals.
- Smoking: non-smoking property; smoking permitted only in designated outdoor areas.
- Children: welcome at all ages. Under 6 stay free using existing beds; extra beds for older children available at additional cost.
- Payment methods: cash (LKR, USD, EUR, GBP), credit/debit cards (Visa, Mastercard), online bank transfer, and local payment gateways HelaPay and WebXPay.
- Pricing: all prices shown on the website include applicable taxes and service charges unless stated otherwise.
- Extended stays: special discounted rates for stays of 5+ nights — contact directly for a quote.
- Parking: free, secure, on-site parking for all guests.
- Heating: all rooms have heating plus extra blankets available — Nuwara Eliya gets cold, especially at night.
- Dietary requirements: vegetarian, vegan, gluten-free, and other special requests accommodated; ask guests to flag these at time of booking.
- Room service: available 24 hours, local and international dishes.
- Getting here: about 160 km from Bandaranaike International Airport (CMB), roughly a 4–5 hour drive; airport pickup/drop-off can be arranged (see transfer pricing above).
- Nearby attractions: Gregory Lake (~2 km), Victoria Park (~3 km), Hakgala Botanical Garden (~5 km), and several tea factories; guided tours can be arranged through the property.

CURRENT ROOMS & PRICING:
${roomLines || '(no rooms currently listed — direct the guest to check the Rooms page or contact us directly)'}

HOW TO BEHAVE:
- Be warm, concise, and helpful — a few sentences per answer, not an essay.
- Encourage booking via the website (/booking or /rooms) when relevant.
- If asked something outside your knowledge (exact availability for specific dates, account-specific booking status, complaints, refund status for a real booking), say you can't check that directly and point them to phone/WhatsApp/email above, or suggest signing in and checking "My Bookings" on the site.
- Never invent prices, policies, or facts not listed above.
- Keep replies in plain text, no markdown headers or code blocks.`;
}

// POST /api/chatbot
// Expects JSON body { messages: { role: 'user' | 'assistant', content: string }[] }
// — the chat history so far. Sends the most recent messages plus a system prompt to
// Gemini, and returns { reply: string } with the AI's response text.
export async function POST(request: NextRequest) {
  try {
    // If no API key is configured, fail gracefully instead of calling Gemini.
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Chatbot is not configured yet. Add GEMINI_API_KEY to .env to enable it.' },
        { status: 503 }
      );
    }

    const { messages } = (await request.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    // Only send the last MAX_HISTORY messages — keeps the request small/cheap while
    // still giving the AI enough recent context to hold a coherent conversation.
    const recent = messages.slice(-MAX_HISTORY);
    const systemPrompt = await buildSystemPrompt();

    // Call the Gemini API. This is a server-to-server fetch to an external service —
    // it happens here (not in the browser) so the API key stays secret.
    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // Gemini calls the assistant's role "model" instead of "assistant" — translate here.
        contents: recent.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
      }),
    });

    // If Gemini itself returned an error status, log it and tell the user the
    // chatbot is temporarily down rather than exposing the raw error.
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[POST /api/chatbot] Gemini error', geminiRes.status, errBody);
      return NextResponse.json({ error: 'The chatbot is temporarily unavailable. Please try again shortly.' }, { status: 502 });
    }

    // Pull the generated text out of Gemini's response shape, with a fallback
    // message in case the response is empty/unexpected.
    const data = await geminiRes.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      "Sorry, I couldn't come up with a reply — please try rephrasing that.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[POST /api/chatbot]', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
