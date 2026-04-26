import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ensureDailyLogTables } from "@/lib/daily-log-helpers";
import type { DailyLog, DailyLogDetail } from "@/lib/supabase";

function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    await ensureDailyLogTables();
    const { searchParams } = new URL(req.url);
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const city     = searchParams.get("city");
    const engineer = searchParams.get("engineer");
    const sort     = searchParams.get("sort") || "date_desc";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (from)     { params.push(from);     conditions.push(`dl.date >= $${params.length}::date`); }
    if (to)       { params.push(to);       conditions.push(`dl.date <= $${params.length}::date`); }
    if (city)     { params.push(city);     conditions.push(`dld.city = $${params.length}`); }
    if (engineer) { params.push(engineer); conditions.push(`$${params.length} = ANY(dld.engineers)`); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const orderDir = sort.endsWith("_asc") ? "ASC" : "DESC";
    const orderCol = sort.startsWith("km") ? "dl.total_km" : "dl.date";

    const rows = await query(`
      SELECT
        dl.id             AS log_id,
        dl.date,
        dl.total_km,
        dl.total_weight,
        dl.engineer_count,
        dl.created_by,
        dl.created_at     AS log_created_at,
        dl.updated_at     AS log_updated_at,
        dld.id            AS detail_id,
        dld.city,
        dld.engineers,
        dld.km,
        dld.weight,
        dld.start_date,
        dld.end_date,
        dld.created_at    AS detail_created_at,
        dld.updated_at    AS detail_updated_at
      FROM daily_logs dl
      LEFT JOIN daily_log_details dld ON dld.daily_log_id = dl.id
      ${where}
      ORDER BY ${orderCol} ${orderDir}, dl.created_at, dld.created_at
    `, params);

    // Group by date (not log_id) so that duplicate daily_logs rows for the
    // same date are merged into a single parent entry in the response.
    // The SQL orders by dl.created_at ASC so the canonical (oldest) log_id
    // for each date is always encountered first.
    const logsMap = new Map<string, DailyLog>(); // key = date string
    for (const r of rows as Record<string, unknown>[]) {
      const date   = toDateStr(r.date);
      const logId  = String(r.log_id);
      if (!logsMap.has(date)) {
        logsMap.set(date, {
          id: logId,
          date,
          total_km: Number(r.total_km) || 0,
          total_weight: Number(r.total_weight) || 0,
          engineer_count: Number(r.engineer_count) || 0,
          created_by: (r.created_by as string | null) ?? null,
          created_at: String(r.log_created_at ?? ""),
          updated_at: String(r.log_updated_at ?? ""),
          details: [],
        });
      }
      if (r.detail_id) {
        const detail: DailyLogDetail = {
          id: String(r.detail_id),
          daily_log_id: logId,
          city: String(r.city ?? ""),
          engineers: (r.engineers as string[]) ?? [],
          km: Number(r.km) || 0,
          weight: Number(r.weight) || 0,
          start_date: toDateStr(r.start_date),
          end_date: toDateStr(r.end_date),
          created_at: String(r.detail_created_at ?? ""),
          updated_at: String(r.detail_updated_at ?? ""),
        };
        logsMap.get(date)!.details.push(detail);
      }
    }

    return NextResponse.json(Array.from(logsMap.values()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
