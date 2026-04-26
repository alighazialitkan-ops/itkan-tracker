import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { recalcParent, logActivity } from "@/lib/daily-log-helpers";

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { city, engineers, km, weight, start_date, end_date } = await req.json();
    const roundedWeight = roundToHalf(Number(weight) || 0);
    const effectiveEnd = end_date && end_date >= start_date ? end_date : start_date;

    const current = await query<{ daily_log_id: string }>(
      `SELECT daily_log_id FROM daily_log_details WHERE id = $1`,
      [params.id]
    );
    if (!current.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const oldLogId = current[0].daily_log_id;

    const logRows = await query<{ id: string }>(
      `INSERT INTO daily_logs (date)
       VALUES ($1::date)
       ON CONFLICT (date) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [start_date]
    );
    const newLogId = logRows[0].id;

    const rows = await query(
      `UPDATE daily_log_details
       SET city=$1, engineers=$2::text[], km=$3, weight=$4,
           start_date=$5::date, end_date=$6::date,
           daily_log_id=$7, updated_at=now()
       WHERE id=$8
       RETURNING *`,
      [city, Array.isArray(engineers) ? engineers.filter((e: string) => e.trim()) : [], km ?? 0, roundedWeight, start_date, effectiveEnd, newLogId, params.id]
    );

    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await recalcParent(newLogId);
    if (oldLogId !== newLogId) await recalcParent(oldLogId);

    const row = rows[0] as Record<string, unknown>;
    const detail = { ...row, start_date: toDateStr(row.start_date), end_date: toDateStr(row.end_date) };

    await logActivity(
      "update", "daily_log_detail", params.id,
      `Updated ${city} entry for ${start_date} — ${(engineers as string[]).join(", ")}`
    );

    return NextResponse.json(detail);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const current = await query<{ daily_log_id: string; city: string; start_date: unknown }>(
      `SELECT daily_log_id, city, start_date FROM daily_log_details WHERE id = $1`,
      [params.id]
    );
    if (!current.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { daily_log_id, city, start_date } = current[0];
    const dateStr = start_date instanceof Date
      ? start_date.toISOString().slice(0, 10)
      : String(start_date).slice(0, 10);

    await query(`DELETE FROM daily_log_details WHERE id = $1`, [params.id]);
    await recalcParent(daily_log_id);

    await logActivity(
      "delete", "daily_log_detail", params.id,
      `Deleted ${city} entry for ${dateStr}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
