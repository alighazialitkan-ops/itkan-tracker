import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TEAMS } from "@/lib/constants";

export async function POST() {
  try {
    // ── Core tables ────────────────────────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS entries (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date       DATE NOT NULL,
        city       TEXT NOT NULL,
        engineers  TEXT[] NOT NULL,
        km         INTEGER DEFAULT 0,
        weight     INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS teams (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name       TEXT UNIQUE NOT NULL,
        members    TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS exclusions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        engineer_name  TEXT UNIQUE NOT NULL,
        excluded       BOOLEAN DEFAULT TRUE,
        note           TEXT DEFAULT '',
        updated_at     TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        password_hash TEXT NOT NULL,
        pin_hash      TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action     TEXT NOT NULL,
        entity     TEXT NOT NULL,
        entity_id  UUID,
        detail     TEXT,
        username   TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

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

    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_no         TEXT UNIQUE NOT NULL,
        order_date       DATE NOT NULL,
        case_no          TEXT,
        serial           TEXT,
        site             TEXT,
        part_description TEXT,
        status           TEXT NOT NULL DEFAULT 'Requested',
        remarks          TEXT,
        awbs             TEXT[] DEFAULT '{}',
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
      )
    `);

    // ── Parent-child daily log tables ──────────────────────────────────────
    await query(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date           DATE NOT NULL,
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

    // ── Ensure UNIQUE constraint on daily_logs.date ────────────────────────
    // Without this, ON CONFLICT (date) in the details POST never fires and
    // every new entry creates a separate parent row for the same date.
    await query(`
      DO $uc$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'daily_logs_date_key'
            AND conrelid = 'daily_logs'::regclass
        ) THEN
          ALTER TABLE daily_logs ADD CONSTRAINT daily_logs_date_key UNIQUE (date);
        END IF;
      END $uc$
    `);

    // ── Deduplicate daily_logs: one row per date ───────────────────────────
    // Keep the earliest-created row per date (canonical), reassign all
    // daily_log_details children to it, then delete the leftover duplicates.
    await query(`
      DO $dedup$ BEGIN
        IF EXISTS (
          SELECT 1 FROM daily_logs GROUP BY date HAVING COUNT(*) > 1
        ) THEN
          -- Move children from duplicates to canonical parent
          UPDATE daily_log_details
          SET daily_log_id = canon.id
          FROM (
            SELECT DISTINCT ON (date) id, date
            FROM daily_logs
            ORDER BY date, created_at ASC
          ) canon
          JOIN daily_logs dup ON dup.date = canon.date AND dup.id <> canon.id
          WHERE daily_log_details.daily_log_id = dup.id;

          -- Delete the now-empty duplicates
          DELETE FROM daily_logs
          USING (
            SELECT DISTINCT ON (date) id AS cid, date
            FROM daily_logs
            ORDER BY date, created_at ASC
          ) canon
          WHERE daily_logs.date = canon.date
            AND daily_logs.id   <> canon.cid;

          -- Recalculate totals on all canonical parents
          UPDATE daily_logs dl SET
            total_km       = agg.km,
            total_weight   = agg.wt,
            engineer_count = agg.eng_cnt,
            updated_at     = NOW()
          FROM (
            SELECT
              dld.daily_log_id,
              COALESCE(SUM(dld.km), 0)                    AS km,
              ROUND(COALESCE(AVG(dld.weight), 0) * 2) / 2 AS wt,
              COUNT(DISTINCT eng)                          AS eng_cnt
            FROM daily_log_details dld,
                 LATERAL UNNEST(dld.engineers) eng
            GROUP BY dld.daily_log_id
          ) agg
          WHERE dl.id = agg.daily_log_id;
        END IF;
      END $dedup$
    `);

    // ── Migrate entries → daily_logs + daily_log_details (first-run only) ─
    await query(`
      DO $mig$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM daily_log_details LIMIT 1)
           AND EXISTS    (SELECT 1 FROM entries         LIMIT 1) THEN

          INSERT INTO daily_logs (date, created_at)
          SELECT date, MIN(created_at)
          FROM entries
          GROUP BY date
          ON CONFLICT (date) DO NOTHING;

          INSERT INTO daily_log_details
            (daily_log_id, city, engineers, km, weight, start_date, end_date, created_at)
          SELECT
            dl.id,
            e.city,
            e.engineers,
            e.km,
            ROUND(e.weight::numeric * 2) / 2,
            e.date,
            e.date,
            e.created_at
          FROM entries e
          JOIN daily_logs dl ON dl.date = e.date;

          -- Recalculate parent totals after migration
          UPDATE daily_logs dl SET
            total_km     = agg.km,
            total_weight = agg.wt
          FROM (
            SELECT daily_log_id,
              SUM(km)                    AS km,
              ROUND(AVG(weight) * 2) / 2 AS wt
            FROM daily_log_details
            GROUP BY daily_log_id
          ) agg
          WHERE dl.id = agg.daily_log_id;

          UPDATE daily_logs dl SET
            engineer_count = agg.cnt
          FROM (
            SELECT dld.daily_log_id, COUNT(DISTINCT eng) AS cnt
            FROM daily_log_details dld,
                 LATERAL UNNEST(dld.engineers) eng
            GROUP BY dld.daily_log_id
          ) agg
          WHERE dl.id = agg.daily_log_id;

        END IF;
      END $mig$
    `);

    // Seed default teams
    for (const name of TEAMS) {
      await query(
        `INSERT INTO teams (name, members) VALUES ($1, '{}') ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Database ready. All tables created, UNIQUE constraint added, duplicates removed, data migrated.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return NextResponse.json({ tables: tables.map((t) => t.tablename) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
