"use client";
import { useState, useEffect } from "react";
import type { Entry, Exclusion } from "@/lib/supabase";

type EngineerStats = {
  name: string;
  totalKm: number;
  standbyCount: number;
  offCount: number;
  avgWeight: number;
  distanceAlert: boolean;
  standbyAlert: boolean;
  excluded: boolean;
  note: string;
};

export default function Tracker() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [eRes, xRes] = await Promise.all([
        fetch("/api/entries"),
        fetch("/api/exclusions"),
      ]);
      const eJson = await eRes.json();
      setEntries(Array.isArray(eJson) ? eJson : []);
      const xJson = await xRes.json();
      setExclusions(Array.isArray(xJson) ? xJson : []);
      setLoading(false);
    }
    load();
  }, []);

  const exclusionMap = new Map(exclusions.map((x) => [x.engineer_name, x]));

  const statsMap = new Map<string, { km: number; standby: number; off: number; weights: number[]; excluded: boolean; note: string }>();

  for (const entry of entries) {
    for (const eng of entry.engineers) {
      if (!statsMap.has(eng)) {
        const ex = exclusionMap.get(eng);
        statsMap.set(eng, { km: 0, standby: 0, off: 0, weights: [], excluded: ex?.excluded ?? false, note: ex?.note ?? "" });
      }
      const s = statsMap.get(eng)!;
      s.km += Number(entry.km);
      s.weights.push(Number(entry.weight));
      if (entry.city === "Standby") s.standby++;
      if (entry.city === "Off") s.off++;
    }
  }

  const active = [...statsMap.entries()].filter(([, s]) => !s.excluded);
  const avgKm = active.length ? active.reduce((sum, [, s]) => sum + s.km, 0) / active.length : 0;
  const avgStandby = active.length ? active.reduce((sum, [, s]) => sum + s.standby, 0) / active.length : 0;
  const distThreshold = avgKm + 500;
  const standbyThreshold = avgStandby + 5;

  const stats: EngineerStats[] = [...statsMap.entries()].map(([name, s]) => ({
    name,
    totalKm: s.km,
    standbyCount: s.standby,
    offCount: s.off,
    avgWeight: s.weights.length ? +(s.weights.reduce((a: number, b: number) => a + b, 0) / s.weights.length).toFixed(1) : 0,
    distanceAlert: !s.excluded && s.km >= distThreshold,
    standbyAlert: !s.excluded && s.standby >= standbyThreshold,
    excluded: s.excluded,
    note: s.note,
  }));

  stats.sort((a, b) => b.totalKm - a.totalKm);
  const maxKm = stats[0]?.totalKm || 1;

  const filtered = search
    ? stats.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : stats;

  const overloadCount = stats.filter((s) => s.distanceAlert).length;
  const standbyAlertCount = stats.filter((s) => s.standbyAlert).length;

  function rankIcon(i: number, eng: EngineerStats) {
    if (eng.excluded) return null;
    const nonExcluded = stats.filter((s) => !s.excluded);
    const rank = nonExcluded.findIndex((s) => s.name === eng.name);
    if (rank === 0) return <span className="text-lg">🥇</span>;
    if (rank === 1) return <span className="text-base">🥈</span>;
    if (rank === 2) return <span className="text-base">🥉</span>;
    return <span className="text-gray-400 text-sm">{rank + 1}</span>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#1a2f5e]">{stats.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Engineers Tracked</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#c9a84c]">{Math.round(avgKm).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Avg KM/Engineer</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">{Math.round(distThreshold).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Distance Alert Threshold</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-orange-500">{standbyThreshold.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Standby Alert Threshold</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input className="input max-w-xs" placeholder="Search engineer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {overloadCount > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full">
            {overloadCount} overloaded
          </span>
        )}
        {standbyAlertCount > 0 && (
          <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
            {standbyAlertCount} standby alert
          </span>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <div className="text-4xl mb-2">📊</div>
            <div>No data found</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f0f4ff] border-b border-blue-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Engineer</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Total KM</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider min-w-[140px]">KM Progress</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Standby</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">OFF</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Avg Weight</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Distance Alert</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Standby Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {filtered.map((eng, i) => (
                <tr
                  key={eng.name}
                  className={`transition-colors ${eng.distanceAlert ? "bg-[#fff5f5]" : "hover:bg-blue-50/30"} ${eng.excluded ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 w-12 text-center">{rankIcon(i, eng)}</td>
                  <td className="px-4 py-3 font-medium text-[#1a2f5e] whitespace-nowrap">{eng.name}</td>
                  <td className="px-4 py-3 font-bold text-[#1a2f5e]">{eng.totalKm.toLocaleString()}</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${eng.distanceAlert ? "bg-red-500" : ""}`}
                        style={{
                          width: `${Math.min(100, (eng.totalKm / maxKm) * 100)}%`,
                          background: eng.distanceAlert ? undefined : "linear-gradient(to right, #1a2f5e, #c9a84c)",
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">{eng.standbyCount}</td>
                  <td className="px-4 py-3 text-center">{eng.offCount}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">{eng.avgWeight}</span>
                  </td>
                  <td className="px-4 py-3">
                    {eng.excluded ? (
                      <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">Excluded</span>
                    ) : eng.distanceAlert ? (
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">⚠ Overload</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">✓ OK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {eng.excluded ? (
                      <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">Excluded</span>
                    ) : eng.standbyAlert ? (
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">⚠ Alert</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">✓ OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
