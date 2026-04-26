import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureDailyLogTables, recalcParent, logActivity } from "@/lib/daily-log-helpers";

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    await ensureDailyLogTables();
    const body = await req.json();
    const { city, engineers, km, weight, start_date, end_date } = body;
    const roundedWeight = roundToHalf(Number(weight) || 0);
    const effectiveEnd = end_date && end_date >= start_date ? end_date : start_date;

    const logRows = await query<{ id: string }>(
      `INSERT INTO daily_logs (date)
       VALUES ($1::date)
       ON CONFLICT (date) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [start_date]
    );
    const dailyLogId = logRows[0].id;

    const detailRows = await query(
      `INSERT INTO daily_log_details
         (daily_log_id, city, engineers, km, weight, start_date, end_date)
       VALUES ($1, $2, $3::text[], $4, $5, $6::date, $7::date)
       RETURNING *`,
      [dailyLogId, city, Array.isArray(engineers) ? engineers.filter((e: string) => e.trim()) : [], km ?? 0, roundedWeight, start_date, effectiveEnd]
    );

    await recalcParent(dailyLogId);

    const row = detailRows[0] as Record<string, unknown>;
    const detail = { ...row, start_date: toDateStr(row.start_date), end_date: toDateStr(row.end_date) };

    await logActivity(
      "create", "daily_log_detail", String(row.id),
      `Added ${city} entry for ${start_date} — ${(engineers as string[]).join(", ")}`
    );

    return NextResponse.json(detail, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
