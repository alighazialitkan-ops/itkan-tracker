"use client";
import { useState, useEffect, useCallback } from "react";
import { CITY_BADGE_COLORS, DEFAULT_CITY_BADGE, CITY_NAMES, DAY_NAMES } from "@/lib/constants";
import { formatDateWithDay, formatShortDate, getMonthRange, seedFrequencyFromEntries } from "@/lib/utils";
import type { DailyLog, DailyLogDetail } from "@/lib/supabase";
import EntryModal from "./EntryModal";
import EditDayModal from "./EditDayModal";
import Toast from "./Toast";

type MainLogProps = { isViewOnly: boolean };

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const CURRENT_YEAR = new Date().getFullYear();

export default function MainLog({ isViewOnly }: MainLogProps) {
  const [logs, setLogs]                 = useState<DailyLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editDetail, setEditDetail]     = useState<DailyLogDetail | null>(null);
  const [defaultDate, setDefaultDate]   = useState<string | undefined>(undefined);
  const [editDayLog, setEditDayLog]     = useState<DailyLog | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filters, setFilters]           = useState({ from: "", to: "", city: "", engineer: "", sort: "date_asc" });
  const [dayFilter, setDayFilter]       = useState("");
  const [monthSel, setMonthSel]         = useState("");
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set());
  const [colSort, setColSort]           = useState<{ col: "km" | "sb" | "off"; dir: "asc" | "desc" } | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filters.from)     p.set("from", filters.from);
    if (filters.to)       p.set("to", filters.to);
    if (filters.city)     p.set("city", filters.city);
    if (filters.engineer) p.set("engineer", filters.engineer);
    p.set("sort", filters.sort);
    const r = await fetch(`/api/daily-logs?${p}`);
    const json = await r.json();
    const data: DailyLog[] = Array.isArray(json) ? json : [];
    setLogs(data);
    setCollapsed(new Set(data.map((l) => l.id)));
    setLoading(false);
    seedFrequencyFromEntries(data.flatMap((log) => log.details.map((d) => d.engineers)));
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  /* ── client-side day-of-week filter ── */
  const displayedLogs = dayFilter
    ? logs.filter((log) => {
        const d = new Date(log.date + "T00:00:00");
        return !isNaN(d.getTime()) && DAY_NAMES[d.getDay()] === dayFilter;
      })
    : logs;

  /* ── client-side column sort ── */
  function toggleColSort(col: "km" | "sb" | "off") {
    setColSort((prev) =>
      prev?.col === col
        ? { col, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { col, dir: "desc" }
    );
  }
  const sortedLogs = colSort
    ? [...displayedLogs].sort((a, b) => {
        const val = (log: DailyLog) => {
          if (colSort.col === "km")  return log.details.reduce((s, d) => s + Number(d.km), 0);
          if (colSort.col === "sb")  return log.details.filter((d) => d.city === "Standby").length;
          return log.details.filter((d) => d.city === "Off").length;
        };
        return colSort.dir === "desc" ? val(b) - val(a) : val(a) - val(b);
      })
    : displayedLogs;

  /* ── aggregate stats ── */
  const allDetails = displayedLogs.flatMap((l) => l.details);

  /* ── per-engineer insight maps ── */
  const engKm      = new Map<string, number>();
  const engAssign  = new Map<string, number>();
  const engStandby = new Map<string, number>();
  const engWeight  = new Map<string, { sum: number; cnt: number }>();
  for (const d of allDetails) {
    for (const e of d.engineers) {
      engKm.set(e,      (engKm.get(e)      ?? 0) + Number(d.km));
      engAssign.set(e,  (engAssign.get(e)  ?? 0) + 1);
      if (d.city === "Standby") engStandby.set(e, (engStandby.get(e) ?? 0) + 1);
      const w = engWeight.get(e) ?? { sum: 0, cnt: 0 };
      engWeight.set(e, { sum: w.sum + Number(d.weight), cnt: w.cnt + 1 });
    }
  }
  const topOf = (m: Map<string, number>) => m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : "—";
  const insightTopKm      = topOf(engKm);
  const insightOverloaded = topOf(engAssign);
  const insightStandby    = topOf(engStandby);
  const insightAssigned   = topOf(engAssign);
  const insightWeight     = engWeight.size
    ? [...engWeight.entries()].sort((a, b) => b[1].sum / b[1].cnt - a[1].sum / a[1].cnt)[0][0]
    : "—";

  /* ── filter helpers ── */
  function handleMonthChange(val: string) {
    setMonthSel(val);
    if (!val) { setFilters((f) => ({ ...f, from: "", to: "" })); return; }
    const [y, m] = val.split("-").map(Number);
    const { from, to } = getMonthRange(y, m);
    setFilters((f) => ({ ...f, from, to }));
  }

  function clearFilters() {
    setFilters({ from: "", to: "", city: "", engineer: "", sort: "date_asc" });
    setDayFilter("");
    setMonthSel("");
  }

  /* ── expand/collapse ── */
  function toggleCollapse(logId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) { next.delete(logId); } else { next.add(logId); }
      return next;
    });
  }
  function expandAll()   { setCollapsed(new Set()); }
  function collapseAll() { setCollapsed(new Set(displayedLogs.map((l) => l.id))); }

  /* ── open modals ── */
  function openAdd(date?: string) {
    setEditDetail(null);
    setDefaultDate(date);
    setShowEntryModal(true);
  }

  function openEdit(detail: DailyLogDetail) {
    setEditDetail(detail);
    setDefaultDate(undefined);
    setShowEntryModal(true);
  }

  /* ── CRUD ── */
  async function handleSave(data: Partial<DailyLogDetail>) {
    if (editDetail) {
      const res = await fetch(`/api/daily-logs/details/${editDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { setToast({ msg: "Failed to update entry", type: "error" }); return; }
      setToast({ msg: "Entry updated", type: "success" });
    } else {
      console.log("[AddEntry] payload:", data);
      const res = await fetch("/api/daily-logs/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[AddEntry] API error:", res.status, errBody);
        setToast({ msg: errBody?.error ?? "Failed to add entry", type: "error" });
        return;
      }
      setToast({ msg: "Entry added", type: "success" });
    }
    setShowEntryModal(false);
    setEditDetail(null);
    setDefaultDate(undefined);
    fetchLogs();
  }

  async function handleDeleteDetail(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/daily-logs/details/${id}`, { method: "DELETE" });
    if (!res.ok) { setToast({ msg: "Failed to delete entry", type: "error" }); return; }
    setToast({ msg: "Entry deleted", type: "success" });
    fetchLogs();
  }

  async function handleDeleteSelected() {
    const count = selectedDays.length;
    if (!confirm(`Delete ${count} selected ${count === 1 ? "day" : "days"} and all their entries? This cannot be undone.`)) return;
    const results = await Promise.all(
      selectedDays.map((id) => fetch(`/api/daily-logs/${id}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      setToast({ msg: `${failed} day(s) failed to delete`, type: "error" });
    } else {
      setToast({ msg: `${count} ${count === 1 ? "day" : "days"} deleted`, type: "success" });
    }
    setSelectedDays([]);
    fetchLogs();
  }

  async function handleDeleteDay(log: DailyLog) {
    const n = log.details.length;
    if (!confirm(
      `This will delete all ${n} ${n === 1 ? "entry" : "entries"} for ${formatDateWithDay(log.date)}. Continue?`
    )) return;
    const res = await fetch(`/api/daily-logs/${log.id}`, { method: "DELETE" });
    if (!res.ok) { setToast({ msg: "Failed to delete day", type: "error" }); return; }
    setToast({ msg: `Day deleted (${n} ${n === 1 ? "entry" : "entries"} removed)`, type: "success" });
    fetchLogs();
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">

      {/* Insight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Top KM",          value: insightTopKm,      color: "text-[#c9a84c]" },
          { label: "Overloaded",      value: insightOverloaded, color: "text-red-500"    },
          { label: "Most Standby",    value: insightStandby,    color: "text-gray-500"   },
          { label: "Most Assigned",   value: insightAssigned,   color: "text-[#1a2f5e]" },
          { label: "Highest Weight",  value: insightWeight,     color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-lg font-bold truncate ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <div>
            <label className="label">From</label>
            <input type="date" className="input w-36" value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input w-36" value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div>
            <label className="label">Month</label>
            <select className="input w-36" value={monthSel} onChange={(e) => handleMonthChange(e.target.value)}>
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={`${CURRENT_YEAR}-${String(i + 1).padStart(2, "0")}`}>
                  {m} {CURRENT_YEAR}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Day of Week</label>
            <select className="input w-32" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
              <option value="">All days</option>
              {DAY_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">City</label>
            <select className="input w-36" value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}>
              <option value="">All cities</option>
              {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Engineer Search</label>
            <input className="input w-44" placeholder="Search engineer…" value={filters.engineer}
              onChange={(e) => setFilters((f) => ({ ...f, engineer: e.target.value }))} />
          </div>
          <div>
            <label className="label">Sort By</label>
            <select className="input w-36" value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="date_desc">Date Newest</option>
              <option value="date_asc">Date Oldest</option>
              <option value="km_desc">KM Highest</option>
              <option value="km_asc">KM Lowest</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="btn-outline text-xs px-3 py-2">Clear Filters</button>
          </div>
        </div>
      </div>

      {/* Table header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1a2f5e]">
            Daily Log{" "}
            <span className="text-sm font-normal text-gray-500">
              ({displayedLogs.length} {displayedLogs.length === 1 ? "day" : "days"} · {allDetails.length} entries)
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll}   className="btn-outline text-xs px-3 py-1.5">Expand All</button>
          <button onClick={collapseAll} className="btn-outline text-xs px-3 py-1.5">Collapse All</button>
          {!isViewOnly && selectedDays.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium transition-colors"
            >
              Delete Selected ({selectedDays.length})
            </button>
          )}
          {!isViewOnly && (
            <button onClick={() => openAdd()} className="btn-primary text-sm">+ Add Entry</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading entries…</div>
        ) : displayedLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <div className="font-medium">No entries found</div>
            <div className="text-sm mt-1">Try adjusting your filters or add a new entry.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f0f4ff] border-b border-blue-100">
              <tr>
                {!isViewOnly && (
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 cursor-pointer"
                      checked={sortedLogs.length > 0 && sortedLogs.every((l) => selectedDays.includes(l.id))}
                      onChange={(e) =>
                        setSelectedDays(e.target.checked ? sortedLogs.map((l) => l.id) : [])
                      }
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Date / City</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Engineers</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleColSort("km")}>
                  KM <span className="ml-0.5">{colSort?.col === "km" ? (colSort.dir === "desc" ? "▼" : "▲") : "⇅"}</span>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleColSort("sb")}>
                  SB <span className="ml-0.5">{colSort?.col === "sb" ? (colSort.dir === "desc" ? "▼" : "▲") : "⇅"}</span>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleColSort("off")}>
                  OFF <span className="ml-0.5">{colSort?.col === "off" ? (colSort.dir === "desc" ? "▼" : "▲") : "⇅"}</span>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Entries / Period</th>
                {!isViewOnly && (
                  <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((log) => {
                const isCollapsed = collapsed.has(log.id);
                const logKm  = log.details.reduce((s, d) => s + Number(d.km), 0);
                const logSb  = log.details.filter((d) => d.city === "Standby").length;
                const logOff = log.details.filter((d) => d.city === "Off").length;
                const logEng = new Set(log.details.flatMap((d) => d.engineers)).size;

                return (
                  <>
                    {/* ── Parent row ── */}
                    <tr
                      key={`log-${log.id}`}
                      className="bg-white border-t-2 border-blue-100 hover:bg-blue-50/20 cursor-pointer"
                      onClick={() => toggleCollapse(log.id)}
                    >
                      {/* Checkbox */}
                      {!isViewOnly && (
                        <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 cursor-pointer"
                            checked={selectedDays.includes(log.id)}
                            onChange={() =>
                              setSelectedDays((prev) =>
                                prev.includes(log.id)
                                  ? prev.filter((id) => id !== log.id)
                                  : [...prev, log.id]
                              )
                            }
                          />
                        </td>
                      )}
                      {/* Date */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 w-3 shrink-0 select-none">
                            {isCollapsed ? "▶" : "▼"}
                          </span>
                          <span className="font-bold text-[#1a2f5e] whitespace-nowrap">
                            {formatDateWithDay(log.date)}
                          </span>
                        </div>
                      </td>
                      {/* Engineers */}
                      <td className="px-4 py-3 font-semibold text-[#1a2f5e]">
                        {logEng} <span className="font-normal text-gray-500 text-xs">engineers</span>
                      </td>
                      {/* KM */}
                      <td className="px-4 py-3 font-bold text-[#c9a84c]">{logKm.toLocaleString()}</td>
                      {/* SB */}
                      <td className="px-4 py-3 font-semibold text-amber-600">{logSb > 0 ? logSb : <span className="text-gray-300">0</span>}</td>
                      {/* OFF */}
                      <td className="px-4 py-3 font-semibold text-gray-500">{logOff > 0 ? logOff : <span className="text-gray-300">0</span>}</td>
                      {/* Weight — empty on parent row */}
                      <td className="px-4 py-3" />
                      {/* Entries count */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {log.details.length} {log.details.length === 1 ? "entry" : "entries"}
                      </td>
                      {/* Actions */}
                      {!isViewOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); openAdd(log.date); }}
                              className="text-xs bg-[#1a2f5e]/10 hover:bg-[#1a2f5e]/20 text-[#1a2f5e] px-2 py-1 rounded font-medium transition-colors"
                            >
                              + Add
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditDayLog(log); }}
                              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded font-medium transition-colors"
                            >
                              Edit Day
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDay(log); }}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded font-medium transition-colors"
                            >
                              Delete Day
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* ── Child rows ── */}
                    {!isCollapsed &&
                      log.details.map((detail) => {
                        const badgeClass = CITY_BADGE_COLORS[detail.city] ?? DEFAULT_CITY_BADGE;
                        const isMultiDay = detail.start_date && detail.end_date && detail.start_date !== detail.end_date;
                        return (
                          <tr
                            key={`detail-${detail.id}`}
                            className="bg-[#f4f6fb] border-t border-blue-100 hover:bg-blue-50/50 transition-colors"
                          >
                            {/* Spacer for checkbox column */}
                            {!isViewOnly && <td className="px-3 py-2.5 w-8" />}
                            {/* City — indented with gold left accent */}
                            <td className="px-4 py-2.5 pl-10 border-l-4 border-[#c9a84c]">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                                {detail.city}
                              </span>
                            </td>
                            {/* Engineers */}
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {detail.engineers.map((eng) => (
                                  <span key={eng} className="bg-[#1a2f5e]/10 text-[#1a2f5e] text-xs px-2 py-0.5 rounded-full">
                                    {eng}
                                  </span>
                                ))}
                              </div>
                            </td>
                            {/* KM */}
                            <td className="px-4 py-2.5 font-semibold text-[#1a2f5e]">
                              {Number(detail.km).toLocaleString()}
                            </td>
                            {/* SB / OFF — empty on child rows */}
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5" />
                            {/* Weight */}
                            <td className="px-4 py-2.5">
                              <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                {detail.weight}
                              </span>
                            </td>
                            {/* Period */}
                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                              {isMultiDay
                                ? `${formatShortDate(detail.start_date)} → ${formatShortDate(detail.end_date)} (${Math.round((new Date(detail.end_date).getTime() - new Date(detail.start_date).getTime()) / 86400000) + 1} days)`
                                : "—"}
                            </td>
                            {/* Row actions */}
                            {!isViewOnly && (
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEdit(detail)}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >Edit</button>
                                  <button
                                    onClick={() => handleDeleteDetail(detail.id)}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                  >Delete</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Entry modal (add / edit single detail) */}
      {showEntryModal && (
        <EntryModal
          key={editDetail?.id ?? "new"}
          detail={editDetail}
          defaultDate={defaultDate}
          onSave={handleSave}
          onClose={() => { setShowEntryModal(false); setEditDetail(null); setDefaultDate(undefined); }}
        />
      )}

      {/* Edit Day modal */}
      {editDayLog && (
        <EditDayModal
          key={editDayLog.id}
          log={editDayLog}
          isViewOnly={isViewOnly}
          onClose={() => setEditDayLog(null)}
          onRefresh={fetchLogs}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
