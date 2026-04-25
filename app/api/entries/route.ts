import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const city     = searchParams.get("city");
    const engineer = searchParams.get("engineer");
    const sort     = searchParams.get("sort") || "date_desc";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (from)     { params.push(from);     conditions.push(`date >= $${params.length}::date`); }
    if (to)       { params.push(to);       conditions.push(`date <= $${params.length}::date`); }
    if (city)     { params.push(city);     conditions.push(`city = $${params.length}`); }
    if (engineer) { params.push(engineer); conditions.push(`$${params.length} = ANY(engineers)`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const orderMap: Record<string, string> = {
      date_desc: "date DESC, created_at DESC",
      date_asc:  "date ASC,  created_at ASC",
      km_desc:   "km DESC",
      km_asc:    "km ASC",
    };
    const order = orderMap[sort] ?? "date DESC, created_at DESC";

    const data = await query(`SELECT * FROM entries ${where} ORDER BY ${order}`, params);
    const normalized = data.map((row: Record<string, unknown>) => ({
      ...row,
      date: row.date ? String(row.date).slice(0, 10) : null,
    }));
    return NextResponse.json(normalized);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, city, engineers, km, weight } = await req.json();
    const rows = await query(
      `INSERT INTO entries (date, city, engineers, km, weight)
       VALUES ($1::date, $2, $3, $4, $5)
       RETURNING *`,
      [date, city, engineers, km ?? 0, weight ?? 1]
    );
    const row = rows[0] as Record<string, unknown>;
    return NextResponse.json(
      { ...row, date: row.date ? String(row.date).slice(0, 10) : null },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
