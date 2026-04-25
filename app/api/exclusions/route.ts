import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const data = await query(`SELECT * FROM exclusions ORDER BY engineer_name`);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { engineer_name, excluded, note } = await req.json();
    const rows = await query(
      `INSERT INTO exclusions (engineer_name, excluded, note, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (engineer_name)
       DO UPDATE SET excluded = $2, note = $3, updated_at = NOW()
       RETURNING *`,
      [engineer_name, excluded, note ?? ""]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
