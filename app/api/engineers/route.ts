import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ENGINEERS } from "@/lib/constants";

let _ready = false;
async function ensureEngineers() {
  if (_ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS engineers (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name       TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const cnt = await query<{ cnt: string }>(`SELECT COUNT(*) AS cnt FROM engineers`);
  if (Number(cnt[0]?.cnt) === 0) {
    for (const name of ENGINEERS) {
      await query(`INSERT INTO engineers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
    }
  }
  _ready = true;
}

export async function GET() {
  try {
    await ensureEngineers();
    const rows = await query<{ id: string; name: string }>(
      `SELECT id, name FROM engineers ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEngineers();
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const rows = await query(
      `INSERT INTO engineers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *`,
      [name.trim()]
    );
    if (!rows.length) return NextResponse.json({ error: "Engineer already exists" }, { status: 409 });
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
