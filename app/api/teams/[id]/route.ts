import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name    !== undefined) { values.push(body.name);    fields.push(`name    = $${values.length}`); }
    if (body.members !== undefined) { values.push(body.members); fields.push(`members = $${values.length}`); }

    if (!fields.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    values.push(params.id);
    const rows = await query(
      `UPDATE teams SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query(`DELETE FROM teams WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
