import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const data = await query(`SELECT * FROM teams ORDER BY name`);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, members } = await req.json();
    const rows = await query(
      `INSERT INTO teams (name, members) VALUES ($1, $2) RETURNING *`,
      [name, members ?? []]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
