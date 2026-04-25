import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { password_hash } = await req.json();
    const rows = await query<{ password_hash: string }>(
      `SELECT password_hash FROM admin_config LIMIT 1`
    );
    if (!rows.length) return NextResponse.json({ error: "Not configured" }, { status: 400 });
    if (rows[0].password_hash !== password_hash) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
