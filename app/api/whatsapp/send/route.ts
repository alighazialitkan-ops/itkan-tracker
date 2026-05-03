import { NextResponse } from 'next/server';
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function GET() {
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: 'whatsapp:+9647728473408',
      body: 'Test message from itkan-tracker',
    });
    return NextResponse.json({ success: true, sid: message.sid });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { to, message } = await req.json();
    const sent = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to,
      body: message,
    });
    return NextResponse.json({ success: true, sid: sent.sid });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
