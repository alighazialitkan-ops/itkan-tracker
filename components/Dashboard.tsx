"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import type { Entry, Team, Exclusion } from "@/lib/supabase";
import { CITY_NAMES } from "@/lib/constants";

interface Filters {
  from: string; to: string; month: string; dayOfWeek: string;
  engineer: string; city: string; team: string; sort: string;
}

const EMPTY: Filters = { from: "", to: "", month: "", dayOfWeek: "", engineer: "", city: "", team: "", sort: "date_desc" };

const SORT_OPTS = [
  { value: "date_desc", label: "Date (Newest)" },
  { value: "date_asc",  label: "Date (Oldest)" },
  { value: "km_desc",   label: "KM (High→Low)" },
  { value: "km_asc",    label: "KM (Low→High)" },
];

const DAY_OPTS = [
  { value: "", label: "All Days" }, { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" }, { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" }, { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" }, { value: "6", label: "Saturday" },
];

const COLORS = ["#1a2f5e", "#c9a84c", "#10b981", "#ef4444", "#6366f1", "#f97316", "#8b5cf6"];

function buildMonths() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieInnerLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.05) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function Dashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [entries, setEntries]     = useState<Entry[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState<Filters>(EMPTY);
  const [pieTab, setPieTab]       = useState<"city" | "engineer">("city");
  const [tSort, setTSort]         = useState<{ col: string; dir: "asc" | "desc" }>({ col: "km", dir: "desc" });
  const prevFilters               = useRef("");
  const months                    = useMemo(buildMonths, []);

  useEffect(() => {
    (async () => {
      try {
        const [eR, tR, xR] = await Promise.all([
          fetch("/api/entries"), fetch("/api/teams"), fetch("/api/exclusions"),
        ]);
        const [eJ, tJ, xJ] = await Promise.all([eR.json(), tR.json(), xR.json()]);
        setEntries(Array.isArray(eJ) ? eJ : []);
        setTeams(Array.isArray(tJ) ? tJ : []);
        setExclusions(Array.isArray(xJ) ? xJ : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Admin activity log — records filter changes to console until a backend endpoint exists
  useEffect(() => {
    if (!isAdmin) return;
    const key = JSON.stringify(filters);
    if (prevFilters.current && key !== prevFilters.current) {
      console.info("[Admin Activity] Dashboard filters changed:", filters);
    }
    prevFilters.current = key;
  }, [filters, isAdmin]);

  const excludedSet = useMemo(
    () => new Set(exclusions.filter((x) => x.excluded).map((x) => x.engineer_name)),
    [exclusions],
  );

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = e.date || "";
      if (filters.from && d < filters.from) return false;
      if (filters.to   && d > filters.to)   return false;
      if (filters.month && !filters.from && !filters.to && d.slice(0, 7) !== filters.month) return false;
      if (filters.dayOfWeek !== "") {
        const day = new Date(d + "T00:00:00");
        if (isNaN(day.getTime()) || day.getDay() !== Number(filters.dayOfWeek)) return false;
      }
      if (filters.engineer && !e.engineers.some((n) => n.toLowerCase().includes(filters.engineer.toLowerCase()))) return false;
      if (filters.city && e.city !== filters.city) return false;
      if (filters.team) {
        const t = teams.find((t) => t.name === filters.team);
        if (!t || !e.engineers.some((n) => t.members.includes(n))) return false;
      }
      return true;
    });
  }, [entries, filters, teams]);

  const prevEntries = useMemo(() => {
    if (filters.from && filters.to) {
      const fromMs = new Date(filters.from).getTime();
      const toMs   = new Date(filters.to + "T23:59:59").getTime();
      const dur    = toMs - fromMs;
      const pTo    = new Date(fromMs - 86400000).toISOString().slice(0, 10);
      const pFrom  = new Date(fromMs - 86400000 - dur).toISOString().slice(0, 10);
      return entries.filter((e) => e.date >= pFrom && e.date <= pTo);
    }
    if (filters.month) {
      const [y, m] = filters.month.split("-").map(Number);
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      const prev = `${py}-${String(pm).padStart(2, "0")}`;
      return entries.filter((e) => e.date.slice(0, 7) === prev);
    }
    return [];
  }, [entries, filters.from, filters.to, filters.month]);

  const kpi = useMemo(() => {
    const totalAsgn = filteredEntries.reduce((s, e) => s + e.engineers.length, 0);
    const totalKm   = filteredEntries.reduce((s, e) => s + Number(e.km), 0);
    const ws        = filteredEntries.map((e) => Number(e.weight)).filter((w) => w > 0);
    const avgLoad   = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0;
    const activeEng = new Set(filteredEntries.flatMap((e) => e.engineers).filter((n) => !excludedSet.has(n))).size;

    const pAsgn   = prevEntries.reduce((s, e) => s + e.engineers.length, 0);
    const pKm     = prevEntries.reduce((s, e) => s + Number(e.km), 0);
    const pWs     = prevEntries.map((e) => Number(e.weight)).filter((w) => w > 0);
    const pAvgLoad = pWs.length ? pWs.reduce((a, b) => a + b, 0) / pWs.length : 0;
    const pActive  = new Set(prevEntries.flatMap((e) => e.engineers).filter((n) => !excludedSet.has(n))).size;

    const pct = (curr: number, prev: number) =>
      prevEntries.length > 0 && prev !== 0 ? ((curr - prev) / prev) * 100 : null;

    return {
      totalAsgn, totalKm, avgLoad, activeEng,
      pctAsgn: pct(totalAsgn, pAsgn), pctKm: pct(totalKm, pKm),
      pctLoad: pct(avgLoad, pAvgLoad), pctActive: pct(activeEng, pActive),
    };
  }, [filteredEntries, prevEntries, excludedSet]);

  const lineChart = useMemo(() => {
    const engKm = new Map<string, number>();
    for (const e of filteredEntries)
      for (const n of e.engineers)
        if (!excludedSet.has(n)) engKm.set(n, (engKm.get(n) || 0) + Number(e.km));

    const top5 = [...engKm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);

    const dateMap = new Map<string, Record<string, number>>();
    for (const e of filteredEntries) {
      if (!dateMap.has(e.date)) dateMap.set(e.date, {});
      const pt = dateMap.get(e.date)!;
      for (const n of e.engineers)
        if (top5.includes(n)) pt[n] = (pt[n] || 0) + Number(e.km);
    }

    return {
      data: [...dateMap.entries()].sort().map(([date, vals]) => ({ date: date.slice(5), ...vals })),
      engineers: top5,
    };
  }, [filteredEntries, excludedSet]);

  const pieData = useMemo(() => {
    if (pieTab === "city") {
      const m = new Map<string, number>();
      for (const e of filteredEntries) m.set(e.city, (m.get(e.city) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    }
    const m = new Map<string, number>();
    for (const e of filteredEntries)
      for (const n of e.engineers)
        if (!excludedSet.has(n)) m.set(n, (m.get(n) || 0) + Number(e.km));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name: name.split(" ")[0], value }));
  }, [filteredEntries, pieTab, excludedSet]);

  const tableData = useMemo(() => {
    const em = new Map<string, { km: number; asgn: number; ws: number[]; standby: number; off: number }>();
    for (const e of filteredEntries)
      for (const n of e.engineers) {
        if (!em.has(n)) em.set(n, { km: 0, asgn: 0, ws: [], standby: 0, off: 0 });
        const r = em.get(n)!;
        r.asgn++;
        r.ws.push(Number(e.weight));
        if (e.city === "Standby") r.standby++;
        else if (e.city === "Off") r.off++;
        else r.km += Number(e.km);
      }

    const allKm   = [...em.entries()].filter(([n]) => !excludedSet.has(n)).map(([, r]) => r.km);
    const avgKm   = allKm.length ? allKm.reduce((a, b) => a + b, 0) / allKm.length : 0;
    const thresh  = avgKm + 500;

    return [...em.entries()].map(([name, r]) => {
      const team     = teams.find((t) => t.members.includes(name));
      const avgW     = r.ws.length ? r.ws.reduce((a, b) => a + b, 0) / r.ws.length : 0;
      const excluded = excludedSet.has(name);
      return {
        name, team: team?.name || "—", km: r.km, asgn: r.asgn,
        avgW: parseFloat(avgW.toFixed(1)), standby: r.standby, off: r.off,
        excluded, overloaded: !excluded && r.km >= thresh,
      };
    });
  }, [filteredEntries, teams, excludedSet]);

  const sortedTable = useMemo(() => {
    return [...tableData].sort((a, b) => {
      const av = a[tSort.col as keyof typeof a] as string | number;
      const bv = b[tSort.col as keyof typeof b] as string | number;
      if (typeof av === "number" && typeof bv === "number")
        return tSort.dir === "asc" ? av - bv : bv - av;
      return tSort.dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [tableData, tSort]);

  function setF<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters((f) => {
      const next = { ...f, [key]: val };
      if (key === "month" && val)              { next.from = ""; next.to = ""; }
      if ((key === "from" || key === "to") && val) next.month = "";
      return next;
    });
  }

  function toggleTSort(col: string) {
    setTSort((p) => ({ col, dir: p.col === col && p.dir === "desc" ? "asc" : "desc" }));
  }

  const hasFilters = Object.entries(filters).some(([k, v]) => k !== "sort" && v !== "");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24 bg-gray-50" />)}
        </div>
        <div className="card animate-pulse h-20 bg-gray-50" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card animate-pulse h-72 bg-gray-50" />
          <div className="card animate-pulse h-72 bg-gray-50" />
        </div>
        <div className="card animate-pulse h-64 bg-gray-50" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<ClipboardIcon />} label="Total Assignments"
          value={kpi.totalAsgn.toLocaleString()} pct={kpi.pctAsgn} color="#1a2f5e"
        />
        <KpiCard
          icon={<RouteIcon />} label="Total KM Covered"
          value={kpi.totalKm.toLocaleString()} pct={kpi.pctKm} color="#c9a84c"
        />
        <KpiCard
          icon={<BoltIcon />} label="Avg Load Score"
          value={kpi.avgLoad.toFixed(2)} pct={kpi.pctLoad} color="#6366f1"
        />
        <KpiCard
          icon={<UsersIcon />} label="Active Engineers"
          value={kpi.activeEng.toLocaleString()} pct={kpi.pctActive} color="#10b981"
        />
      </div>

      {/* ── Filters Bar ── */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
          <div>
            <label className="label text-[10px]">From</label>
            <input type="date" className="input text-xs py-1.5" value={filters.from}
              onChange={(e) => setF("from", e.target.value)} />
          </div>
          <div>
            <label className="label text-[10px]">To</label>
            <input type="date" className="input text-xs py-1.5" value={filters.to}
              onChange={(e) => setF("to", e.target.value)} />
          </div>
          <div>
            <label className="label text-[10px]">Month</label>
            <select className="input text-xs py-1.5" value={filters.month}
              onChange={(e) => setF("month", e.target.value)}>
              <option value="">All Months</option>
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Day of Week</label>
            <select className="input text-xs py-1.5" value={filters.dayOfWeek}
              onChange={(e) => setF("dayOfWeek", e.target.value)}>
              {DAY_OPTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Engineer</label>
            <input type="text" className="input text-xs py-1.5" placeholder="Search name…"
              value={filters.engineer} onChange={(e) => setF("engineer", e.target.value)} />
          </div>
          <div>
            <label className="label text-[10px]">City</label>
            <select className="input text-xs py-1.5" value={filters.city}
              onChange={(e) => setF("city", e.target.value)}>
              <option value="">All Cities</option>
              {CITY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Team</label>
            <select className="input text-xs py-1.5" value={filters.team}
              onChange={(e) => setF("team", e.target.value)}>
              <option value="">All Teams</option>
              {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Sort By</label>
            <select className="input text-xs py-1.5" value={filters.sort}
              onChange={(e) => setF("sort", e.target.value)}>
              {SORT_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {hasFilters && (
          <button onClick={() => setFilters(EMPTY)}
            className="mt-2.5 text-xs text-[#c9a84c] hover:text-[#a8873a] font-semibold hover:underline transition-colors">
            ✕ Clear All Filters
          </button>
        )}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Line chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-[#1a2f5e] mb-3">
            Workload Trend — KM over time <span className="text-gray-400 font-normal">(top 5 engineers)</span>
          </h3>
          {lineChart.data.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineChart.data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }}
                  angle={-40} textAnchor="end" interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: unknown) => [Number(v).toLocaleString() + " km"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {lineChart.engineers.map((eng, i) => (
                  <Line key={eng} type="monotone" dataKey={eng}
                    name={eng.split(" ")[0]} stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1a2f5e]">Distribution</h3>
            <div className="flex rounded overflow-hidden border border-gray-200">
              {(["city", "engineer"] as const).map((tab) => (
                <button key={tab} onClick={() => setPieTab(tab)}
                  className={`text-xs px-3 py-1 font-medium transition-colors ${
                    pieTab === tab ? "bg-[#1a2f5e] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}>
                  {tab === "city" ? "By City" : "By Engineer"}
                </button>
              ))}
            </div>
          </div>
          {pieData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={90}
                  dataKey="value" labelLine={false} label={PieInnerLabel}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v: unknown) => [Number(v).toLocaleString()]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Breakdown Table ── */}
      <div className="card overflow-x-auto">
        <h3 className="text-sm font-semibold text-[#1a2f5e] mb-3">Engineer Breakdown</h3>
        {sortedTable.length === 0 ? <EmptyState /> : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { key: "name",    label: "Engineer"    },
                  { key: "team",    label: "Team"        },
                  { key: "km",      label: "Total KM"    },
                  { key: "asgn",    label: "Assignments" },
                  { key: "avgW",    label: "Avg Weight"  },
                  { key: "standby", label: "Standby"     },
                  { key: "off",     label: "OFF"         },
                ].map((col) => (
                  <th key={col.key} onClick={() => toggleTSort(col.key)}
                    className="pb-2 pr-4 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-[#1a2f5e] select-none whitespace-nowrap">
                    {col.label}
                    {tSort.col === col.key && (
                      <span className="ml-1 text-[#c9a84c]">{tSort.dir === "desc" ? "↓" : "↑"}</span>
                    )}
                  </th>
                ))}
                <th className="pb-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTable.map((row, i) => (
                <tr key={i} className={`border-b border-gray-50 transition-colors ${
                  row.excluded    ? "opacity-40 bg-gray-50" :
                  row.overloaded  ? "bg-red-50/60" :
                  "hover:bg-blue-50/20"
                }`}>
                  <td className="py-2 pr-4 font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">{row.team}</td>
                  <td className="py-2 pr-4 font-semibold text-[#1a2f5e]">{row.km.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.asgn}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.avgW}</td>
                  <td className="py-2 pr-4 text-amber-600 font-medium">{row.standby}</td>
                  <td className="py-2 pr-4 text-gray-400">{row.off}</td>
                  <td className="py-2">
                    {row.excluded ? (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200 font-medium">
                        Excluded
                      </span>
                    ) : row.overloaded ? (
                      <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-medium">
                        Overloaded
                      </span>
                    ) : (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-200 font-medium">
                        OK
                      </span>
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

/* ── Sub-components ── */

function KpiCard({ icon, label, value, pct, color }: {
  icon: React.ReactNode; label: string; value: string; pct: number | null; color: string;
}) {
  const pctText = pct !== null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : null;
  return (
    <div className="card flex items-start gap-3 py-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}1a` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold mt-0.5 leading-none" style={{ color }}>{value}</p>
        {pctText && (
          <p className={`text-[11px] mt-1 font-medium ${pct! >= 0 ? "text-green-600" : "text-red-500"}`}>
            {pctText} <span className="text-gray-400 font-normal">vs prev period</span>
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm gap-2">
      <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      No data matches the current filters
    </div>
  );
}

function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
