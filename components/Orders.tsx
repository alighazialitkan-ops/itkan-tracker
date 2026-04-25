"use client";
import { useState, useEffect, useCallback } from "react";
import Toast from "./Toast";
import SerialSearch from "./SerialSearch";
import type { Order, Asset } from "@/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  "Requested",
  "Awaiting Shipment",
  "Shipped",
  "Delivered",
  "On Hold",
  "Cancelled",
] as const;
type Status = (typeof STATUSES)[number];

const STATUS_STYLES: Record<string, string> = {
  "Requested":         "bg-amber-100  text-amber-800",
  "Awaiting Shipment": "bg-blue-100   text-blue-800",
  "Shipped":           "bg-purple-100 text-purple-800",
  "Delivered":         "bg-green-100  text-green-800",
  "On Hold":           "bg-orange-100 text-orange-800",
  "Cancelled":         "bg-red-100    text-red-800",
};

const today = new Date().toISOString().split("T")[0];

// ── Local types ───────────────────────────────────────────────────────────────

type Filters = {
  order_no: string; case_no: string; serial: string; site: string;
  status: string; from: string; to: string; awb: string; part: string;
};

const EMPTY_FILTERS: Filters = {
  order_no: "", case_no: "", serial: "", site: "",
  status: "", from: "", to: "", awb: "", part: "",
};

type OrderForm = {
  order_no: string; order_date: string; case_no: string;
  serial: string; site: string; part_description: string;
  status: Status; awbs: string[]; remarks: string;
};

const EMPTY_FORM: OrderForm = {
  order_no: "", order_date: today, case_no: "",
  serial: "", site: "", part_description: "",
  status: "Requested", awbs: [""], remarks: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}

function UnlockIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  );
}

// ── Order Modal ───────────────────────────────────────────────────────────────

type ModalProps = {
  order: Order | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (action: "create" | "update", id: string, orderNo: string) => void;
};

function OrderModal({ order, isAdmin, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState<OrderForm>(
    order
      ? {
          order_no:         order.order_no,
          order_date:       order.order_date,
          case_no:          order.case_no          ?? "",
          serial:           order.serial           ?? "",
          site:             order.site             ?? "",
          part_description: order.part_description ?? "",
          status:           (order.status as Status) ?? "Requested",
          awbs:             (order.awbs ?? []).length > 0 ? [...order.awbs] : [""],
          remarks:          order.remarks          ?? "",
        }
      : { ...EMPTY_FORM, awbs: [""] }
  );

  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [siteLocked, setSiteLocked]   = useState(!!order?.serial);

  function setField<K extends keyof OrderForm>(key: K, val: OrderForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSerialChange(val: string) {
    setField("serial", val);
    if (!val.trim()) {
      setField("site", "");
      setSiteLocked(false);
    }
  }

  function handleAssetSelect(a: Asset) {
    setField("serial", a.serial);
    setField("site", a.site);
    setSiteLocked(true);
  }

  function addAwb()             { if (form.awbs.length < 10) setField("awbs", [...form.awbs, ""]); }
  function removeAwb(i: number) { setField("awbs", form.awbs.filter((_, idx) => idx !== i)); }
  function updateAwb(i: number, v: string) {
    const next = [...form.awbs]; next[i] = v; setField("awbs", next);
  }

  async function handleSave() {
    setError("");
    if (!form.order_no.trim()) return setError("Order No is required");
    if (!form.order_date)      return setError("Order Date is required");
    setSaving(true);
    try {
      const payload = { ...form, awbs: form.awbs.map((a) => a.trim()).filter(Boolean) };
      const url    = order ? `/api/orders/${order.id}` : "/api/orders";
      const method = order ? "PUT" : "POST";
      const r    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? "Save failed"); setSaving(false); return; }
      onSaved(order ? "update" : "create", json.id, json.order_no);
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">

        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1a2f5e] text-lg">{order ? "Edit Order" : "New Order"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Order No + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Order No *</label>
              <input className="input" placeholder="e.g. ORD-2025-001" value={form.order_no} onChange={(e) => setField("order_no", e.target.value)} />
            </div>
            <div>
              <label className="label">Order Date *</label>
              <input type="date" className="input" value={form.order_date} onChange={(e) => setField("order_date", e.target.value)} />
            </div>
          </div>

          {/* Case No + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Case No</label>
              <input className="input" placeholder="e.g. CS-1042" value={form.case_no} onChange={(e) => setField("case_no", e.target.value)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setField("status", e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Serial (typeahead) + Site (locked) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Serial No</label>
              <SerialSearch
                value={form.serial}
                onChange={handleSerialChange}
                onSelect={handleAssetSelect}
                placeholder="Search assets…"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Site</label>
                {isAdmin && siteLocked && (
                  <button
                    type="button"
                    onClick={() => setSiteLocked(false)}
                    className="flex items-center gap-1 text-[11px] text-[#c9a84c] font-semibold hover:underline"
                  >
                    <UnlockIcon /> Unlock
                  </button>
                )}
              </div>
              <input
                className={`input transition-colors ${siteLocked ? "bg-blue-50 text-gray-600" : ""}`}
                placeholder="Auto-filled from serial"
                value={form.site}
                readOnly={siteLocked && !isAdmin}
                onChange={(e) => setField("site", e.target.value)}
              />
            </div>
          </div>

          {/* Part Description */}
          <div>
            <label className="label">Part Description</label>
            <textarea
              className="input resize-none" rows={2}
              placeholder="Describe the part or item being ordered…"
              value={form.part_description}
              onChange={(e) => setField("part_description", e.target.value)}
            />
          </div>

          {/* AWB Numbers */}
          <div>
            <label className="label">AWB Numbers ({form.awbs.length}/10)</label>
            <div className="space-y-2">
              {form.awbs.map((awb, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input" placeholder={`AWB ${i + 1}`} value={awb} onChange={(e) => updateAwb(i, e.target.value)} />
                  {form.awbs.length > 1 && (
                    <button type="button" onClick={() => removeAwb(i)}
                      className="text-red-400 hover:text-red-600 text-xl w-9 h-9 flex items-center justify-center flex-shrink-0">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.awbs.length < 10 && (
              <button type="button" onClick={addAwb}
                className="mt-2 text-sm text-[#1a2f5e] font-medium hover:underline flex items-center gap-1">
                <span className="text-lg leading-none">+</span> Add AWB
              </button>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="label">Remarks</label>
            <textarea
              className="input resize-none" rows={2}
              placeholder='Internal notes, e.g. "To Kirkuk", "Urgent", "On Shelf"…'
              value={form.remarks}
              onChange={(e) => setField("remarks", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5 pt-3 border-t">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : order ? "Update Order" : "Create Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Orders Page ──────────────────────────────────────────────────────────

export default function Orders({ isAdmin }: { isAdmin: boolean }) {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS);
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    (Object.entries(filters) as [string, string][]).forEach(([k, v]) => { if (v) p.set(k, v); });
    try {
      const r    = await fetch(`/api/orders?${p}`);
      const json = await r.json();
      setOrders(Array.isArray(json) ? json : []);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const kpi = {
    total:     orders.length,
    shipped:   orders.filter((o) => o.status === "Shipped").length,
    pending:   orders.filter((o) => o.status === "Requested" || o.status === "Awaiting Shipment").length,
    delivered: orders.filter((o) => o.status === "Delivered").length,
  };

  async function logActivity(action: string, entityId: string, orderNo: string) {
    await fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, entity: "order", entity_id: entityId, detail: orderNo, username: isAdmin ? "admin" : "user" }),
    }).catch(() => {});
  }

  async function handleDelete(id: string) {
    const target = orders.find((o) => o.id === id);
    const r = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (r.ok) {
      setToast({ msg: "Order deleted", type: "success" });
      if (target) logActivity("deleted", id, target.order_no);
      fetchOrders();
    } else {
      setToast({ msg: "Delete failed", type: "error" });
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a2f5e]">Order Tracking</h1>
          <p className="text-sm text-gray-400 mt-0.5">Spare parts &amp; equipment orders</p>
        </div>
        <button onClick={() => { setEditOrder(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
          <span className="text-lg leading-none">+</span> New Order
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Orders" value={kpi.total}     color="text-[#1a2f5e]" />
        <KpiCard label="Shipped"      value={kpi.shipped}   color="text-purple-700" />
        <KpiCard label="Pending"      value={kpi.pending}   color="text-amber-700" />
        <KpiCard label="Delivered"    value={kpi.delivered} color="text-green-700" />
      </div>

      {/* Filter Bar */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <input className="input" placeholder="Order No"         value={filters.order_no} onChange={(e) => setFilters((f) => ({ ...f, order_no: e.target.value }))} />
          <input className="input" placeholder="Case No"          value={filters.case_no}  onChange={(e) => setFilters((f) => ({ ...f, case_no:  e.target.value }))} />
          <input className="input" placeholder="Serial"           value={filters.serial}   onChange={(e) => setFilters((f) => ({ ...f, serial:   e.target.value }))} />
          <input className="input" placeholder="Site"             value={filters.site}     onChange={(e) => setFilters((f) => ({ ...f, site:     e.target.value }))} />
          <select className="input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="input" placeholder="AWB"              value={filters.awb}  onChange={(e) => setFilters((f) => ({ ...f, awb:  e.target.value }))} />
          <input className="input" placeholder="Part Description"  value={filters.part} onChange={(e) => setFilters((f) => ({ ...f, part: e.target.value }))} />
          <input type="date" className="input" title="From" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <input type="date" className="input" title="To"   value={filters.to}   onChange={(e) => setFilters((f) => ({ ...f, to:   e.target.value }))} />
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-outline text-sm">Clear Filters</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-4xl">📦</div>
            <p className="font-medium text-gray-500">No orders found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters or create a new order.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f0f4ff] border-b border-blue-100">
                <tr>
                  {["Order No", "Order Date", "Case No", "Serial", "Site", "Part Description", "Status", "AWB(s)", "Remarks", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#1a2f5e] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[#1a2f5e] whitespace-nowrap">{o.order_no}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{o.order_date}</td>
                    <td className="px-4 py-3 text-gray-600">{o.case_no || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-600">{o.serial || <span className="text-gray-300 font-sans">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{o.site || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px]">
                      {o.part_description ? <span className="block truncate" title={o.part_description}>{o.part_description}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      {(o.awbs ?? []).length === 0 ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {o.awbs.map((awb, i) => (
                            <span key={i} className="inline-block text-xs bg-[#1a2f5e]/10 text-[#1a2f5e] px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{awb}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[140px]">
                      {o.remarks ? <span className="block truncate" title={o.remarks}>{o.remarks}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <button onClick={() => { setEditOrder(o); setShowModal(true); }} className="text-[#1a2f5e] hover:text-[#c9a84c] text-xs font-semibold transition-colors">Edit</button>
                        {isAdmin && (
                          <button onClick={() => setDeleteId(o.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition-colors">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-[#1a2f5e] text-lg mb-2">Delete Order?</h3>
            <p className="text-gray-500 text-sm mb-5">This action cannot be undone. The order and all associated AWBs will be permanently removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-outline">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <OrderModal
          order={editOrder}
          isAdmin={isAdmin}
          onClose={() => setShowModal(false)}
          onSaved={(action, id, orderNo) => {
            setShowModal(false);
            fetchOrders();
            setToast({ msg: action === "create" ? "Order created" : "Order updated", type: "success" });
            logActivity(action === "create" ? "created" : "edited", id, orderNo);
          }}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
