import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const rows = await query(`SELECT id FROM admin_config LIMIT 1`);
    return NextResponse.json({ configured: rows.length > 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const existing = await query(`SELECT id FROM admin_config LIMIT 1`);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already configured" }, { status: 400 });
    }
    const { password_hash, pin_hash } = await req.json();
    await query(
      `INSERT INTO admin_config (password_hash, pin_hash) VALUES ($1, $2)`,
      [password_hash, pin_hash]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
