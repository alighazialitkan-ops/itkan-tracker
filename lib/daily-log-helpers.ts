import { query } from "@/lib/db";

let _tablesReady = false;

export async function ensureDailyLogTables(): Promise<void> {
  if (_tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date           DATE UNIQUE NOT NULL,
      total_km       INTEGER DEFAULT 0,
      total_weight   NUMERIC(4,1) DEFAULT 0,
      engineer_count INTEGER DEFAULT 0,
      created_by     TEXT,
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS daily_log_details (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      daily_log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
      city         TEXT NOT NULL,
      engineers    TEXT[] NOT NULL,
      km           INTEGER DEFAULT 0,
      weight       NUMERIC(4,1) DEFAULT 0,
      start_date   DATE,
      end_date     DATE,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  _tablesReady = true;
}

export async function recalcParent(dailyLogId: string): Promise<void> {
  const counts = await query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM daily_log_details WHERE daily_log_id = $1`,
    [dailyLogId]
  );
  const cnt = Number(counts[0]?.cnt ?? 0);

  if (cnt === 0) {
    await query(`DELETE FROM daily_logs WHERE id = $1`, [dailyLogId]);
    return;
  }

  await query(
    `UPDATE daily_logs SET
      total_km = (
        SELECT COALESCE(SUM(km), 0)
        FROM daily_log_details WHERE daily_log_id = $1
      ),
      total_weight = (
        SELECT ROUND(COALESCE(AVG(weight), 0) * 2) / 2
        FROM daily_log_details WHERE daily_log_id = $1
      ),
      engineer_count = (
        SELECT COUNT(DISTINCT eng)
        FROM daily_log_details dld2, LATERAL UNNEST(dld2.engineers) eng
        WHERE dld2.daily_log_id = $1
      ),
      updated_at = now()
    WHERE id = $1`,
    [dailyLogId]
  );
}

export async function logActivity(
  action: string,
  entity: string,
  entityId: string | null,
  detail: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_log (action, entity, entity_id, detail, username)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, entity, entityId, detail, "user"]
    );
  } catch {
    // Never fail the main operation due to logging errors
  }
}
