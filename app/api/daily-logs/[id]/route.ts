import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logActivity } from "@/lib/daily-log-helpers";

function toDateStr(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const logs = await query<{ date: unknown }>(
      `SELECT date FROM daily_logs WHERE id = $1`,
      [params.id]
    );
    if (!logs.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const date = toDateStr(logs[0].date);

    const counts = await query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt FROM daily_log_details WHERE daily_log_id = $1`,
      [params.id]
    );
    const cnt = Number(counts[0]?.cnt || 0);

    // CASCADE deletes all children automatically
    await query(`DELETE FROM daily_logs WHERE id = $1`, [params.id]);

    await logActivity(
      "delete", "daily_log", params.id,
      `Deleted day ${date} with ${cnt} ${cnt === 1 ? "entry" : "entries"}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
