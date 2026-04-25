import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { serial, site, city, customer } = await req.json();
    if (!serial || !site) return NextResponse.json({ error: "serial and site are required" }, { status: 400 });

    const dup = await query(`SELECT id FROM assets WHERE serial = $1 AND id != $2`, [serial, params.id]);
    if (dup.length > 0) return NextResponse.json({ error: "Serial already exists" }, { status: 409 });

    const rows = await query(
      `UPDATE assets SET serial=$1, site=$2, city=$3, customer=$4 WHERE id=$5 RETURNING *`,
      [serial, site, city || null, customer || null, params.id]
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
    await query(`DELETE FROM assets WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
