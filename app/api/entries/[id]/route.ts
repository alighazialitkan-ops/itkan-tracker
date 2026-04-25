import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function toDateStr(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { date, city, engineers, km, weight } = await req.json();
    const rows = await query(
      `UPDATE entries SET date=$1::date, city=$2, engineers=$3, km=$4, weight=$5
       WHERE id=$6 RETURNING *`,
      [date, city, engineers, km, weight, params.id]
    );
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const row = rows[0] as Record<string, unknown>;
    return NextResponse.json({ ...row, date: toDateStr(row.date) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query(`DELETE FROM entries WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
