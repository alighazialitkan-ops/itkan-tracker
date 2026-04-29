"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { DailyLog, DailyLogDetail, Team, Exclusion } from "@/lib/supabase";
import { CITY_NAMES } from "@/lib/constants";

interface Filters {
  from: string; to: string; month: string;
  engineer: string; city: string; team: string;
}

const EMPTY: Filters = { from: "", to: "", month: "", engineer: "", city: "", team: "" };

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

export default function Dashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [details, setDetails]       = useState<DailyLogDetail[]>([]);
  const [teams, setTeams]           = useState<Team[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState<Filters>(EMPTY);
  const prevFilters                 = useRef("");
  const months                      = useMemo(buildMonths, []);

  useEffect(() => {
    (async () => {
      try {
        const [logsR, tR, xR] = await Promise.all([
          fetch("/api/daily-logs"), fetch("/api/teams"), fetch("/api/exclusions"),
        ]);
        const [logsJ, tJ, xJ] = await Promise.all([logsR.json(), tR.json(), xR.json()]);
        const logs: DailyLog[] = Array.isArray(logsJ) ? logsJ : [];
        setDetails(logs.flatMap((l) => l.details));
        setTeams(Array.isArray(tJ) ? tJ : []);
        setExclusions(Array.isArray(xJ) ? xJ : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const key = JSON.stringify(filters);
    if (prevFilters.current && key !== prevFilters.current)
      console.info("[Admin Activity] Dashboard filters changed:", filters);
    prevFilters.current = key;
  }, [filters, isAdmin]);

  const excludedSet = useMemo(
    () => new Set(exclusions.filter((x) => x.excluded).map((x) => x.engineer_name)),
    [exclusions],
  );

  const filtered = useMemo(() => {
    return details.filter((d) => {
      const date = d.start_date || "";
      if (filters.from  && date < filters.from) return false;
      if (filters.to    && date > filters.to)   return false;
      if (filters.month && !filters.from && !filters.to && date.slice(0, 7) !== filters.month) return false;
      if (filters.engineer && !d.engineers.some((n) => n.toLowerCase().includes(filters.engineer.toLowerCase()))) return false;
      if (filters.city  && d.city !== filters.city) return false;
      if (filters.team) {
        const t = teams.find((t) => t.name === filters.team);
        if (!t || !d.engineers.some((n) => t.members.includes(n))) return false;
      }
      return true;
    });
  }, [details, filters, teams]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const kmMap = new Map<string, number>();
    const standbyMap = new Map<string, number>();
    for (const d of filtered) {
      for (const n of d.engineers) {
        if (excludedSet.has(n)) continue;
        kmMap.set(n, (kmMap.get(n) || 0) + Number(d.km));
        if (d.city === "Standby") standbyMap.set(n, (standbyMap.get(n) || 0) + 1);
      }
    }
    const kmEntries = [...kmMap.entries()].sort((a, b) => b[1] - a[1]);
    const sbEntries = [...standbyMap.entries()].sort((a, b) => b[1] - a[1]);
    const topDist    = kmEntries[0]  ? { name: kmEntries[0][0],  val: kmEntries[0][1].toLocaleString() + " km" }  : null;
    const mostSb     = sbEntries[0]  ? { name: sbEntries[0][0],  val: sbEntries[0][1] + " days" }                 : null;
    const vals = kmEntries.map(([, v]) => v);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const threshold = avg + 500;
    const overloaded = kmEntries.filter(([, v]) => v >= threshold);
    const mostOver   = overloaded[0] ? { name: overloaded[0][0], val: overloaded[0][1].toLocaleString() + " km" } : null;
    const lowestLoad = kmEntries[kmEntries.length - 1] ? { name: kmEntries[kmEntries.length - 1][0], val: kmEntries[kmEntries.length - 1][1].toLocaleString() + " km" } : null;
    return { topDist, mostSb, mostOver, lowestLoad };
  }, [filtered, excludedSet]);

  /* ── Chart 1: KM per engineer ── */
  const kmData = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of filtered)
      for (const n of d.engineers)
        if (!excludedSet.has(n) && d.city !== "Standby" && d.city !== "Off")
          m.set(n, (m.get(n) || 0) + Number(d.km));

    const vals = [...m.values()];
    const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const threshold = avg + 500;

    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, km]) => ({ name: name.split(" ")[0], fullName: name, km, overloaded: km >= threshold }));
  }, [filtered, excludedSet]);

  /* ── Chart 2: Assignments per city ── */
  const cityData = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of filtered)
      if (d.city !== "Standby" && d.city !== "Off")
        m.set(d.city, (m.get(d.city) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count }));
  }, [filtered]);

  /* ── Chart 3: Standby count per engineer ── */
  const standbyData = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of filtered)
      if (d.city === "Standby")
        for (const n of d.engineers)
          if (!excludedSet.has(n)) m.set(n, (m.get(n) || 0) + 1);

    const vals = [...m.values()];
    const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const threshold = avg + 5;

    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name: name.split(" ")[0], count, alert: count >= threshold }));
  }, [filtered, excludedSet]);

  /* ── Chart 4: Avg weight per engineer ── */
  const weightData = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const d of filtered)
      for (const n of d.engineers)
        if (!excludedSet.has(n)) {
          if (!m.has(n)) m.set(n, []);
          m.get(n)!.push(Number(d.weight));
        }
    return [...m.entries()]
      .map(([name, ws]) => ({
        name: name.split(" ")[0],
        avg: parseFloat((ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(2)),
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 20);
  }, [filtered, excludedSet]);

  function setF<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters((f) => {
      const next = { ...f, [key]: val };
      if (key === "month" && val)               { next.from = ""; next.to = ""; }
      if ((key === "from" || key === "to") && val) next.month = "";
      return next;
    });
  }

  const hasFilters = Object.values(filters).some((v) => v !== "");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-24 bg-gray-50" />)}
        </div>
        <div className="card animate-pulse h-16 bg-gray-50" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-72 bg-gray-50" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Top Distance"     name={kpi.topDist?.name}    value={kpi.topDist?.val    ?? "—"} color="#1a2f5e" icon={<RouteIcon />} />
        <KpiCard label="Most Standby"     name={kpi.mostSb?.name}     value={kpi.mostSb?.val     ?? "—"} color="#c9a84c" icon={<BoltIcon />} />
        <KpiCard label="Most Overloaded"  name={kpi.mostOver?.name}   value={kpi.mostOver?.val   ?? "—"} color="#ef4444" icon={<ClipboardIcon />} />
        <KpiCard label="Lowest Load"      name={kpi.lowestLoad?.name} value={kpi.lowestLoad?.val ?? "—"} color="#10b981" icon={<UsersIcon />} />
      </div>

      {/* ── Filters ── */}
      <div className="card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
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
        </div>
        {hasFilters && (
          <button onClick={() => setFilters(EMPTY)}
            className="mt-2.5 text-xs text-[#c9a84c] hover:text-[#a8873a] font-semibold hover:underline transition-colors">
            ✕ Clear All Filters
          </button>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ChartCard title="KM per Engineer" subtitle="top 20 · overloaded in red">
          {kmData.length === 0 ? <EmptyState /> : (
            <ScrollableChart dataLength={kmData.length}>
              <BarChart data={kmData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, _: any, entry: any) => [Number(v).toLocaleString() + " km", entry?.payload?.fullName]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5eaf5" }}
                />
                <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="km" position="top" style={{ fontSize: 9, fill: "#6b7280" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : v} />
                  {kmData.map((d, i) => <Cell key={i} fill={d.overloaded ? "#ef4444" : "#1a2f5e"} />)}
                </Bar>
              </BarChart>
            </ScrollableChart>
          )}
        </ChartCard>

        <ChartCard title="Assignments per City" subtitle="excluding Standby & Off">
          {cityData.length === 0 ? <EmptyState /> : (
            <ScrollableChart dataLength={cityData.length}>
              <BarChart data={cityData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" vertical={false} />
                <XAxis dataKey="city" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => [Number(v).toLocaleString(), "Assignments"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5eaf5" }}
                />
                <Bar dataKey="count" fill="#c9a84c" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "#6b7280" }} />
                </Bar>
              </BarChart>
            </ScrollableChart>
          )}
        </ChartCard>

        <ChartCard title="Standby Count per Engineer" subtitle="alert threshold: avg + 5">
          {standbyData.length === 0 ? <EmptyState /> : (
            <ScrollableChart dataLength={standbyData.length}>
              <BarChart data={standbyData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => [Number(v).toLocaleString(), "Standby days"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5eaf5" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 9, fill: "#6b7280" }} />
                  {standbyData.map((d, i) => <Cell key={i} fill={d.alert ? "#ef4444" : "#d68910"} />)}
                </Bar>
              </BarChart>
            </ScrollableChart>
          )}
        </ChartCard>

        <ChartCard title="Avg Weight per Engineer" subtitle="rounded to nearest 0.5">
          {weightData.length === 0 ? <EmptyState /> : (
            <ScrollableChart dataLength={weightData.length}>
              <BarChart data={weightData} margin={{ top: 20, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: unknown) => [Number(v).toFixed(2), "Avg weight"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5eaf5" }}
                />
                <Bar dataKey="avg" fill="#1e8449" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="avg" position="top" style={{ fontSize: 9, fill: "#6b7280" }} />
                </Bar>
              </BarChart>
            </ScrollableChart>
          )}
        </ChartCard>

      </div>
    </div>
  );
}

/* ── Shared sub-components ── */

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#1a2f5e]">{title}</h3>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ScrollableChart({ children, dataLength }: { children: React.ReactNode; dataLength: number }) {
  const minWidth = Math.max(300, dataLength * 36);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>
        <ResponsiveContainer width="100%" height={300}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
      <svg className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      No data matches the current filters
    </div>
  );
}

function KpiCard({ label, name, value, color, icon }: { label: string; name?: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-3 py-4">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}1a` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        {name && <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{name}</p>}
        <p className="text-lg font-bold leading-none mt-0.5" style={{ color }}>{value}</p>
      </div>
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
