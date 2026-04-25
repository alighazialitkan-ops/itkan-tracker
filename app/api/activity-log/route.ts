import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const rows = await query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 200`);
    return NextResponse.json(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, entity, entity_id, detail, username } = await req.json();
    const rows = await query(
      `INSERT INTO activity_log (action, entity, entity_id, detail, username)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [action, entity || "order", entity_id || null, detail || null, username || "user"]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
