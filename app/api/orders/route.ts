import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

function toDateStr(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const order_no = searchParams.get("order_no");
    const case_no  = searchParams.get("case_no");
    const serial   = searchParams.get("serial");
    const site     = searchParams.get("site");
    const status   = searchParams.get("status");
    const awb      = searchParams.get("awb");
    const part     = searchParams.get("part");
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (order_no) { params.push(`%${order_no}%`); conditions.push(`o.order_no ILIKE $${params.length}`); }
    if (case_no)  { params.push(`%${case_no}%`);  conditions.push(`o.case_no  ILIKE $${params.length}`); }
    if (serial)   { params.push(`%${serial}%`);   conditions.push(`o.serial   ILIKE $${params.length}`); }
    if (site)     { params.push(`%${site}%`);     conditions.push(`o.site     ILIKE $${params.length}`); }
    if (status)   { params.push(status);           conditions.push(`o.status = $${params.length}`); }
    if (part)     { params.push(`%${part}%`);     conditions.push(`o.part_description ILIKE $${params.length}`); }
    if (from)     { params.push(from);             conditions.push(`o.order_date >= $${params.length}::date`); }
    if (to)       { params.push(to);               conditions.push(`o.order_date <= $${params.length}::date`); }
    if (awb) {
      params.push(`%${awb}%`);
      conditions.push(`EXISTS (SELECT 1 FROM order_awbs oa WHERE oa.order_id = o.id AND oa.awb_number ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query<Record<string, unknown>>(
      `SELECT o.*,
              COALESCE(
                array_agg(oa.awb_number ORDER BY oa.created_at)
                FILTER (WHERE oa.awb_number IS NOT NULL),
                '{}'
              ) AS awbs
       FROM orders o
       LEFT JOIN order_awbs oa ON oa.order_id = o.id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      params
    );

    return NextResponse.json(rows.map((r) => ({ ...r, order_date: toDateStr(r.order_date) })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_no, order_date, case_no, serial, site, part_description, status, remarks, awbs = [] } = body;

    if (!order_no?.trim()) return NextResponse.json({ error: "Order No is required" }, { status: 400 });
    if (!order_date)        return NextResponse.json({ error: "Order Date is required" }, { status: 400 });

    const existing = await query(`SELECT id FROM orders WHERE order_no = $1`, [order_no.trim()]);
    if (existing.length > 0) return NextResponse.json({ error: "Order No already exists" }, { status: 409 });

    const rows = await query<Record<string, unknown>>(
      `INSERT INTO orders (order_no, order_date, case_no, serial, site, part_description, status, remarks)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8)
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
      ]
    );

    const order    = rows[0];
    const orderId  = order.id as string;
    const awbList  = (awbs as string[]).filter((a: string) => a.trim());

    for (const awb of awbList) {
      await query(`INSERT INTO order_awbs (order_id, awb_number) VALUES ($1, $2)`, [orderId, awb.trim()]);
    }

    return NextResponse.json(
      { ...order, order_date: toDateStr(order.order_date), awbs: awbList },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
