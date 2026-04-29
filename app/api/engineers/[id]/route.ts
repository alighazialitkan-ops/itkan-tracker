import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const current = await query<{ name: string }>(`SELECT name FROM engineers WHERE id = $1`, [params.id]);
    if (!current.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const oldName = current[0].name;
    const newName = name.trim();

    if (oldName === newName) return NextResponse.json({ id: params.id, name: newName });

    const dup = await query(`SELECT id FROM engineers WHERE name = $1 AND id != $2`, [newName, params.id]);
    if (dup.length > 0) return NextResponse.json({ error: "Engineer already exists" }, { status: 409 });

    const rows = await query(`UPDATE engineers SET name = $1 WHERE id = $2 RETURNING *`, [newName, params.id]);

    await query(
      `UPDATE daily_log_details SET engineers = array_replace(engineers, $1::text, $2::text) WHERE $1 = ANY(engineers)`,
      [oldName, newName]
    );

    await query(
      `UPDATE exclusions SET engineer_name = $1 WHERE engineer_name = $2`,
      [newName, oldName]
    ).catch(() => {});

    return NextResponse.json(rows[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query(`DELETE FROM engineers WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
