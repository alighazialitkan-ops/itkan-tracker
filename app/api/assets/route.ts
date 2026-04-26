import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

let _assetsReady = false;
async function ensureAssetsTable() {
  if (_assetsReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS assets (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      serial     TEXT UNIQUE NOT NULL,
      site       TEXT NOT NULL,
      city       TEXT,
      customer   TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  _assetsReady = true;
}

export async function GET(req: NextRequest) {
  try {
    await ensureAssetsTable();
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
    await ensureAssetsTable();
    const { serial, site, city, customer } = await req.json();
    if (!serial || !site) return NextResponse.json({ error: "serial and site are required" }, { status: 400 });
    const rows = await query(
      `INSERT INTO assets (serial, site, city, customer) VALUES ($1, $2, $3, $4)
       ON CONFLICT (serial) DO UPDATE SET site = EXCLUDED.site, city = EXCLUDED.city, customer = EXCLUDED.customer
       RETURNING *`,
      [serial, site, city || null, customer || null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
