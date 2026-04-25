import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TEAMS } from "@/lib/constants";

export async function POST() {
  try {
    // Create tables
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

    // Seed default teams (skip if already exist)
    for (const name of TEAMS) {
      await query(
        `INSERT INTO teams (name, members) VALUES ($1, '{}') ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }

    return NextResponse.json({ success: true, message: "Database ready. All tables created and default teams seeded." });
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
