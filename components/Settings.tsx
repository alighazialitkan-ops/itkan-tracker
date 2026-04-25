"use client";
import { useEffect, useState } from "react";
import { ENGINEERS } from "@/lib/constants";
import type { Entry, Exclusion } from "@/lib/supabase";
import Toast from "./Toast";

export default function Settings() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exclusions, setExclusions] = useState<Map<string, Exclusion>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "excluded" | "active">("all");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const [eRes, xRes] = await Promise.all([
        fetch("/api/entries"),
        fetch("/api/exclusions"),
      ]);
      const eJson = await eRes.json();
      const xJson = await xRes.json();
      const eData: Entry[] = Array.isArray(eJson) ? eJson : [];
      const xData: Exclusion[] = Array.isArray(xJson) ? xJson : [];
      setEntries(eData);
      const map = new Map(xData.map((x) => [x.engineer_name, x]));
      setExclusions(map);
      const noteMap: Record<string, string> = {};
      for (const x of xData) noteMap[x.engineer_name] = x.note || "";
      setNotes(noteMap);
      setLoading(false);
    }
    load();
  }, []);

  const engStatsMap = new Map<string, { km: number; standby: number }>();
  for (const e of entries) {
    for (const eng of e.engineers) {
      const s = engStatsMap.get(eng) || { km: 0, standby: 0 };
      s.km += Number(e.km);
      if (e.city === "Standby") s.standby++;
      engStatsMap.set(eng, s);
    }
  }

  const activeEngineers = ENGINEERS.filter((e) => !exclusions.get(e)?.excluded);
  const avgKm = activeEngineers.length
    ? activeEngineers.reduce((s, e) => s + (engStatsMap.get(e)?.km || 0), 0) / activeEngineers.length
    : 0;
  const avgStandby = activeEngineers.length
    ? activeEngineers.reduce((s, e) => s + (engStatsMap.get(e)?.standby || 0), 0) / activeEngineers.length
    : 0;

  async function toggleExclusion(name: string, currentlyExcluded: boolean) {
    const newVal = !currentlyExcluded;
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineer_name: name, excluded: newVal, note: notes[name] || "" }),
    });
    const res = await fetch("/api/exclusions");
    const data: Exclusion[] = await res.json();
    setExclusions(new Map(data.map((x) => [x.engineer_name, x])));
    setToast({ msg: `${name} ${newVal ? "excluded" : "included"}`, type: "success" });
  }

  async function saveNote(name: string) {
    const ex = exclusions.get(name);
    if (!ex) return;
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineer_name: name, excluded: ex.excluded, note: notes[name] || "" }),
    });
    setToast({ msg: "Note saved", type: "success" });
  }

  const excludedCount = Array.from(exclusions.values()).filter((x) => x.excluded).length;

  const displayed = ENGINEERS.filter((name) => {
    const ex = exclusions.get(name);
    const isExcluded = ex?.excluded ?? false;
    if (filter === "excluded" && !isExcluded) return false;
    if (filter === "active" && isExcluded) return false;
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#1a2f5e]">Alert Exclusions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {excludedCount} engineer{excludedCount !== 1 ? "s" : ""} excluded from alert calculations
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input className="input w-48" placeholder="Search engineer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input w-32" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "excluded" | "active")}>
            <option value="all">All</option>
            <option value="excluded">Excluded</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f0f4ff] border-b border-blue-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Engineer</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Total KM</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Standby</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Dist. Alert Preview</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Standby Preview</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Exclude</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider min-w-[160px]">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {displayed.map((name) => {
                const stats = engStatsMap.get(name) || { km: 0, standby: 0 };
                const ex = exclusions.get(name);
                const isExcluded = ex?.excluded ?? false;
                const distAlert = !isExcluded && stats.km >= avgKm + 500;
                const standbyAlert = !isExcluded && stats.standby >= avgStandby + 5;

                return (
                  <tr key={name} className={`hover:bg-blue-50/30 transition-colors ${isExcluded ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium text-[#1a2f5e]">{name}</td>
                    <td className="px-4 py-3 font-bold">{stats.km.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{stats.standby}</td>
                    <td className="px-4 py-3">
                      {isExcluded ? (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Excluded</span>
                      ) : distAlert ? (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">⚠ Overload</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isExcluded ? (
                        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Excluded</span>
                      ) : standbyAlert ? (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">⚠ Alert</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExclusion(name, isExcluded)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isExcluded ? "bg-red-500" : "bg-gray-300"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isExcluded ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isExcluded && (
                        <div className="flex gap-1">
                          <input
                            className="input text-xs py-1 px-2 w-28"
                            placeholder="Note…"
                            value={notes[name] || ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [name]: e.target.value }))}
                            onBlur={() => saveNote(name)}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
