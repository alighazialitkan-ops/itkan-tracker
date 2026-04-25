import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serial = searchParams.get("serial");
    if (serial) {
      const rows = await query(
        `SELECT * FROM assets WHERE serial ILIKE $1 ORDER BY serial LIMIT 20`,
        [`%${serial}%`]
      );
      return NextResponse.json(rows);
    }
    const rows = await query(`SELECT * FROM assets ORDER BY serial`);
    return NextResponse.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { serial, site } = await req.json();
    if (!serial || !site) return NextResponse.json({ error: "serial and site are required" }, { status: 400 });
    const rows = await query(
      `INSERT INTO assets (serial, site) VALUES ($1, $2)
       ON CONFLICT (serial) DO UPDATE SET site = EXCLUDED.site
       RETURNING *`,
      [serial, site]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
