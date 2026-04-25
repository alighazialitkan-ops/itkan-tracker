"use client";
import { useState, useEffect, useCallback } from "react";
import { CITY_BADGE_COLORS, DEFAULT_CITY_BADGE, CITY_NAMES, DAY_NAMES } from "@/lib/constants";
import { formatDateWithDay, getMonthRange, seedFrequencyFromEntries } from "@/lib/utils";
import type { Entry } from "@/lib/supabase";
import EntryModal from "./EntryModal";
import Toast from "./Toast";

type MainLogProps = { isViewOnly: boolean };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CURRENT_YEAR = new Date().getFullYear();

export default function MainLog({ isViewOnly }: MainLogProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filters, setFilters] = useState({
    from: "", to: "", city: "", engineer: "", sort: "date_desc",
  });
  const [dayFilter, setDayFilter] = useState("");
  const [monthSel, setMonthSel] = useState("");

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.city) params.set("city", filters.city);
    if (filters.engineer) params.set("engineer", filters.engineer);
    params.set("sort", filters.sort);
    const r = await fetch(`/api/entries?${params}`);
    const json = await r.json();
    const data: Entry[] = Array.isArray(json) ? json : [];
    setEntries(data);
    setLoading(false);
    seedFrequencyFromEntries(data.map((e) => e.engineers));
  }, [filters]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const displayed = dayFilter
    ? entries.filter((e) => {
        const d = new Date(e.date + "T00:00:00");
        return DAY_NAMES[d.getDay()] === dayFilter;
      })
    : entries;

  function handleMonthChange(val: string) {
    setMonthSel(val);
    if (!val) { setFilters((f) => ({ ...f, from: "", to: "" })); return; }
    const [y, m] = val.split("-").map(Number);
    const { from, to } = getMonthRange(y, m);
    setFilters((f) => ({ ...f, from, to }));
  }

  async function handleSave(data: Partial<Entry>) {
    if (editEntry) {
      await fetch(`/api/entries/${editEntry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setToast({ msg: "Entry updated", type: "success" });
    } else {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setToast({ msg: "Entry added", type: "success" });
    }
    setShowModal(false);
    setEditEntry(null);
    fetchEntries();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    setToast({ msg: "Entry deleted", type: "success" });
    fetchEntries();
  }

  const totalKm = displayed.reduce((s, e) => s + Number(e.km), 0);
  const avgWeight = displayed.length ? (displayed.reduce((s, e) => s + Number(e.weight), 0) / displayed.length).toFixed(1) : "0";
  const activeEng = new Set(displayed.flatMap((e) => e.engineers)).size;

  function clearFilters() {
    setFilters({ from: "", to: "", city: "", engineer: "", sort: "date_desc" });
    setDayFilter("");
    setMonthSel("");
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Entries", value: displayed.length, color: "text-[#1a2f5e]" },
          { label: "Total KM", value: totalKm.toLocaleString(), color: "text-[#c9a84c]" },
          { label: "Avg Weight Score", value: avgWeight, color: "text-purple-600" },
          { label: "Active Engineers", value: activeEng, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <div>
            <label className="label">From</label>
            <input type="date" className="input w-36" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input w-36" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div>
            <label className="label">Month</label>
            <select className="input w-36" value={monthSel} onChange={(e) => handleMonthChange(e.target.value)}>
              <option value="">All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={`${CURRENT_YEAR}-${String(i + 1).padStart(2, "0")}`}>{m} {CURRENT_YEAR}</option>
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
            <select className="input w-36" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}>
              <option value="">All cities</option>
              {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Engineer Search</label>
            <input className="input w-44" placeholder="Search engineer…" value={filters.engineer} onChange={(e) => setFilters((f) => ({ ...f, engineer: e.target.value }))} />
          </div>
          <div>
            <label className="label">Sort By</label>
            <select className="input w-36" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
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

      {/* Table header + Add button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#1a2f5e]">Daily Log <span className="text-sm font-normal text-gray-500">({displayed.length} entries)</span></h2>
        {!isViewOnly && (
          <button onClick={() => { setEditEntry(null); setShowModal(true); }} className="btn-primary text-sm">
            + Add Entry
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading entries…</div>
        ) : displayed.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📋</div>
            <div className="font-medium">No entries found</div>
            <div className="text-sm mt-1">Try adjusting your filters or add a new entry.</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f0f4ff] border-b border-blue-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">City</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Engineers</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">KM</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Weight</th>
                {!isViewOnly && <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {displayed.map((entry) => {
                const badgeClass = CITY_BADGE_COLORS[entry.city] ?? DEFAULT_CITY_BADGE;
                return (
                  <tr key={entry.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-[#1a2f5e]">
                      {formatDateWithDay(entry.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                        {entry.city}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {entry.engineers.map((eng) => (
                          <span key={eng} className="inline-block bg-[#1a2f5e]/10 text-[#1a2f5e] text-xs px-2 py-0.5 rounded-full">
                            {eng}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#1a2f5e]">{entry.km.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {entry.weight}
                      </span>
                    </td>
                    {!isViewOnly && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditEntry(entry); setShowModal(true); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <EntryModal
          entry={editEntry}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
