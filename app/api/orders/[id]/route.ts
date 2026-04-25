import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function toDateStr(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { order_no, order_date, case_no, serial, site, part_description, status, remarks, awbs = [] } = body;

    if (!order_no?.trim()) return NextResponse.json({ error: "Order No is required" }, { status: 400 });

    const dup = await query(
      `SELECT id FROM orders WHERE order_no = $1 AND id != $2`,
      [order_no.trim(), params.id]
    );
    if (dup.length > 0) return NextResponse.json({ error: "Order No already exists" }, { status: 409 });

    const rows = await query<Record<string, unknown>>(
      `UPDATE orders
       SET order_no=$1, order_date=$2::date, case_no=$3, serial=$4, site=$5,
           part_description=$6, status=$7, remarks=$8, updated_at=now()
       WHERE id=$9
       RETURNING *`,
      [
        order_no.trim(),
        order_date,
        case_no || null,
        serial  || null,
        site    || null,
        part_description || null,
        status  || "Requested",
        remarks || null,
        params.id,
      ]
    );

    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await query(`DELETE FROM order_awbs WHERE order_id = $1`, [params.id]);

    const awbList = (awbs as string[]).filter((a: string) => a.trim());
    for (const awb of awbList) {
      await query(`INSERT INTO order_awbs (order_id, awb_number) VALUES ($1, $2)`, [params.id, awb.trim()]);
    }

    const order = rows[0];
    return NextResponse.json({ ...order, order_date: toDateStr(order.order_date), awbs: awbList });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await query(`DELETE FROM orders WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
