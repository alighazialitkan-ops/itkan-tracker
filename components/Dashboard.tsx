"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import type { Entry, Exclusion } from "@/lib/supabase";

export default function Dashboard() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
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

  const excludedSet = new Set(exclusions.filter((x) => x.excluded).map((x) => x.engineer_name));

  // Engineer KM
  const engKmMap = new Map<string, number>();
  for (const e of entries) {
    for (const eng of e.engineers) {
      if (!excludedSet.has(eng)) {
        engKmMap.set(eng, (engKmMap.get(eng) || 0) + Number(e.km));
      }
    }
  }
  const avgKm = engKmMap.size ? [...engKmMap.values()].reduce((a, b) => a + b, 0) / engKmMap.size : 0;
  const distThreshold = avgKm + 500;

  const kmData = [...engKmMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, km]) => ({ name: name.split(" ")[0], fullName: name, km, overloaded: km >= distThreshold }));

  // Standby count
  const standbyMap = new Map<string, number>();
  for (const e of entries) {
    if (e.city === "Standby") {
      for (const eng of e.engineers) {
        if (!excludedSet.has(eng)) standbyMap.set(eng, (standbyMap.get(eng) || 0) + 1);
      }
    }
  }
  const standbyData = [...standbyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name: name.split(" ")[0], count }));

  // City assignments
  const cityMap = new Map<string, number>();
  for (const e of entries) {
    if (e.city !== "Standby" && e.city !== "Off") {
      cityMap.set(e.city, (cityMap.get(e.city) || 0) + 1);
    }
  }
  const cityData = [...cityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city, count]) => ({ city, count }));

  // Entries by month
  const monthMap = new Map<string, number>();
  for (const e of entries) {
    const month = e.date ? String(e.date).slice(0, 7) : null;
    if (!month) continue;
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
  }
  const monthData = [...monthMap.entries()]
    .sort()
    .map(([month, count]) => ({ month: month.slice(5), count }));

  const overloadedCount = kmData.filter((d) => d.overloaded).length;
  const standbyAlertCount = (() => {
    const avgStandby = standbyMap.size ? [...standbyMap.values()].reduce((a, b) => a + b, 0) / standbyMap.size : 0;
    return [...standbyMap.values()].filter((v) => v >= avgStandby + 5).length;
  })();

  if (loading) return <div className="p-8 text-center text-gray-400">Loading dashboard…</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#1a2f5e]">{entries.reduce((s, e) => s + e.engineers.length, 0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Assignments</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#c9a84c]">{entries.reduce((s, e) => s + Number(e.km), 0).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total KM Covered</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600">{overloadedCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Overloaded Engineers</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-amber-500">{standbyAlertCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Standby Alerts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="KM by Engineer (top 20)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={kmData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, _: any, entry: any) => [Number(v).toLocaleString() + " km", entry?.payload?.fullName]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                {kmData.map((d, i) => (
                  <Cell key={i} fill={d.overloaded ? "#ef4444" : "#1a2f5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Standby Count by Engineer (top 20)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={standbyData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#c9a84c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Assignments by City">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cityData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="city" tick={{ fontSize: 10, fill: "#6b7280" }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#243d7a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Entries by Month">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf5" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-[#1a2f5e] mb-3">{title}</h3>
      {children}
    </div>
  );
}
