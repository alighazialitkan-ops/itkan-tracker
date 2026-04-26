"use client";
import { useEffect, useState, useCallback } from "react";
import { ENGINEERS } from "@/lib/constants";
import type { Entry, Exclusion, Asset } from "@/lib/supabase";
import SerialSearch from "./SerialSearch";
import Toast from "./Toast";

// ── Iraqi cities for assets dropdown ─────────────────────────────────────────
const ASSET_CITIES = [
  "Baghdad", "Basra", "Karbala", "Najaf", "Diyala", "Babil",
  "Wasit", "Maysan", "Dhi Qar", "Muthanna", "Qadisiyah",
  "Anbar", "Salahaddin", "Kirkuk", "Nineveh", "Erbil",
  "Sulaymaniyah", "Dohuk",
];

type AssetForm = { serial: string; site: string; city: string; customer: string };
const EMPTY_ASSET: AssetForm = { serial: "", site: "", city: "", customer: "" };

// ── Asset Modal ───────────────────────────────────────────────────────────────

type AssetModalProps = {
  asset: Asset | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
};

function AssetModal({ asset, onClose, onSaved, showToast }: AssetModalProps) {
  const [form, setForm] = useState<AssetForm>(
    asset
      ? { serial: asset.serial, site: asset.site, city: asset.city ?? "", customer: asset.customer ?? "" }
      : { ...EMPTY_ASSET }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  function setField<K extends keyof AssetForm>(k: K, v: AssetForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    setError("");
    if (!form.serial.trim()) return setError("Serial Number is required");
    if (!form.site.trim())   return setError("Site Name is required");
    setSaving(true);
    try {
      const url    = asset ? `/api/assets/${asset.id}` : "/api/assets";
      const method = asset ? "PUT" : "POST";
      const r    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? "Save failed"); setSaving(false); return; }
      showToast(asset ? "Asset updated" : "Asset added", "success");
      onSaved();
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1a2f5e] text-lg">{asset ? "Edit Asset" : "Add Asset"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div>
            <label className="label">Serial Number *</label>
            {asset ? (
              <input className="input" value={form.serial} onChange={(e) => setField("serial", e.target.value)} />
            ) : (
              <SerialSearch
                value={form.serial}
                onChange={(v) => setField("serial", v)}
                onSelect={(a) => setForm({ serial: a.serial, site: a.site, city: a.city ?? "", customer: a.customer ?? "" })}
                placeholder="Type to search or enter new…"
                allowNew
              />
            )}
          </div>

          <div>
            <label className="label">Site Name *</label>
            <input className="input" placeholder="e.g. Ibn Sina Hospital" value={form.site} onChange={(e) => setField("site", e.target.value)} />
          </div>

          <div>
            <label className="label">City</label>
            <select className="input" value={form.city} onChange={(e) => setField("city", e.target.value)}>
              <option value="">Select city…</option>
              {ASSET_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Customer</label>
            <input className="input" placeholder="e.g. Ministry of Health" value={form.customer} onChange={(e) => setField("customer", e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5 pt-3 border-t">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : asset ? "Update Asset" : "Add Asset"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Add Panel ────────────────────────────────────────────────────────────

type BulkAddProps = {
  onDone: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
};

function BulkAddPanel({ onDone, showToast }: BulkAddProps) {
  const [text, setText]         = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult]     = useState("");

  async function handleImport() {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setImporting(true);
    setResult("");
    let ok = 0;
    const errors: string[] = [];
    for (const line of lines) {
      const sep   = line.includes("|") ? "|" : ",";
      const parts = line.split(sep).map((p) => p.trim());
      const [serial, site, city, customer] = parts;
      if (!serial || !site) { errors.push(`"${line}" — missing serial or site`); continue; }
      try {
        const r    = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serial, site, city: city || null, customer: customer || null }),
        });
        if (r.ok) {
          ok++;
        } else {
          const j = await r.json().catch(() => ({}));
          errors.push(`"${serial}" — ${j?.error ?? "failed"}`);
        }
      } catch { errors.push(`"${serial}" — network error`); }
    }
    setImporting(false);
    setResult(`✓ ${ok} added${errors.length > 0 ? `\n${errors.join("\n")}` : ""}`);
    if (ok > 0) {
      showToast(`${ok} asset${ok > 1 ? "s" : ""} imported`, "success");
      onDone();
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[#1a2f5e] text-sm">Bulk Add Assets</h3>
        <span className="text-xs text-gray-400">One per line: SERIAL, SITE, CITY, CUSTOMER</span>
      </div>
      <textarea
        className="input resize-none font-mono text-xs"
        rows={6}
        placeholder={`MR-2024-001, Ibn Sina Hospital, Baghdad, Ministry of Health\nCT-2023-055, Basra General Hospital, Basra, Ministry of Health`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button onClick={handleImport} disabled={importing || !text.trim()} className="btn-primary text-sm">
          {importing ? "Importing…" : "Import"}
        </button>
        {result && <pre className="text-xs font-mono whitespace-pre-wrap text-green-700">{result}</pre>}
      </div>
    </div>
  );
}

// ── Main Settings Component ───────────────────────────────────────────────────

type SettingsTab = "engineers" | "assets";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("engineers");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-white rounded-xl border border-blue-100 shadow-sm p-1 w-fit">
        {(["engineers", "assets"] as SettingsTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === t ? "bg-[#1a2f5e] text-white" : "text-gray-500 hover:text-[#1a2f5e]"
            }`}
          >
            {t === "engineers" ? "Engineer Alerts" : "Assets"}
          </button>
        ))}
      </div>

      {activeTab === "engineers" && <EngineerAlerts showToast={showToast} />}
      {activeTab === "assets"    && <AssetsManager showToast={showToast} />}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Engineer Alerts section (extracted from original Settings) ────────────────

function EngineerAlerts({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [exclusions, setExclusions] = useState<Map<string, Exclusion>>(new Map());
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState<"all" | "excluded" | "active">("all");
  const [notes, setNotes]           = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [eRes, xRes] = await Promise.all([fetch("/api/entries"), fetch("/api/exclusions")]);
      const eData: Entry[]     = await eRes.json().then((j) => Array.isArray(j) ? j : []);
      const xData: Exclusion[] = await xRes.json().then((j) => Array.isArray(j) ? j : []);
      setEntries(eData);
      setExclusions(new Map(xData.map((x) => [x.engineer_name, x])));
      const nm: Record<string, string> = {};
      for (const x of xData) nm[x.engineer_name] = x.note || "";
      setNotes(nm);
      setLoading(false);
    })();
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
    ? activeEngineers.reduce((s, e) => s + (engStatsMap.get(e)?.km || 0), 0) / activeEngineers.length : 0;
  const avgStandby = activeEngineers.length
    ? activeEngineers.reduce((s, e) => s + (engStatsMap.get(e)?.standby || 0), 0) / activeEngineers.length : 0;

  async function toggleExclusion(name: string, currentlyExcluded: boolean) {
    const newVal = !currentlyExcluded;
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineer_name: name, excluded: newVal, note: notes[name] || "" }),
    });
    const data: Exclusion[] = await fetch("/api/exclusions").then((r) => r.json());
    setExclusions(new Map(data.map((x) => [x.engineer_name, x])));
    showToast(`${name} ${newVal ? "excluded" : "included"}`, "success");
  }

  async function saveNote(name: string) {
    const ex = exclusions.get(name);
    if (!ex) return;
    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engineer_name: name, excluded: ex.excluded, note: notes[name] || "" }),
    });
    showToast("Note saved", "success");
  }

  const excludedCount = Array.from(exclusions.values()).filter((x) => x.excluded).length;
  const displayed = ENGINEERS.filter((name) => {
    const ex = exclusions.get(name);
    const isExcluded = ex?.excluded ?? false;
    if (filter === "excluded" && !isExcluded) return false;
    if (filter === "active"   &&  isExcluded) return false;
    if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
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
                const stats      = engStatsMap.get(name) || { km: 0, standby: 0 };
                const ex         = exclusions.get(name);
                const isExcluded = ex?.excluded ?? false;
                const distAlert  = !isExcluded && stats.km >= avgKm + 500;
                const standbyAlert = !isExcluded && stats.standby >= avgStandby + 5;
                return (
                  <tr key={name} className={`hover:bg-blue-50/30 transition-colors ${isExcluded ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-medium text-[#1a2f5e]">{name}</td>
                    <td className="px-4 py-3 font-bold">{stats.km.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">{stats.standby}</td>
                    <td className="px-4 py-3">
                      {isExcluded ? <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Excluded</span>
                        : distAlert ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">⚠ Overload</span>
                        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isExcluded ? <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">Excluded</span>
                        : standbyAlert ? <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">⚠ Alert</span>
                        : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExclusion(name, isExcluded)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isExcluded ? "bg-red-500" : "bg-gray-300"}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isExcluded ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {isExcluded && (
                        <input
                          className="input text-xs py-1 px-2 w-28"
                          placeholder="Note…"
                          value={notes[name] || ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [name]: e.target.value }))}
                          onBlur={() => saveNote(name)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Assets Manager section ────────────────────────────────────────────────────

function AssetsManager({ showToast }: { showToast: (msg: string, type: "success" | "error") => void }) {
  const [assets, setAssets]         = useState<Asset[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editAsset, setEditAsset]   = useState<Asset | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [showBulk, setShowBulk]     = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const r    = await fetch("/api/assets");
      const json = await r.json();
      setAssets(Array.isArray(json) ? json : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const displayed = assets.filter((a) => {
    const q = search.toLowerCase();
    return !q
      || a.serial.toLowerCase().includes(q)
      || a.site.toLowerCase().includes(q)
      || (a.city ?? "").toLowerCase().includes(q)
      || (a.customer ?? "").toLowerCase().includes(q);
  });

  async function handleDelete(id: string) {
    const r = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    setDeleteId(null);
    if (r.ok) { showToast("Asset deleted", "success"); fetchAssets(); }
    else       { showToast("Delete failed", "error"); }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#1a2f5e]">Assets</h2>
          <p className="text-sm text-gray-500 mt-0.5">{assets.length} asset{assets.length !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input w-56"
            placeholder="Search serial, site, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowBulk((v) => !v)}
            className="btn-outline text-sm"
          >
            {showBulk ? "Hide Bulk Add" : "Bulk Add"}
          </button>
          <button
            onClick={() => { setEditAsset(null); setShowModal(true); }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> Add Asset
          </button>
        </div>
      </div>

      {/* Bulk Add */}
      {showBulk && (
        <BulkAddPanel
          onDone={fetchAssets}
          showToast={showToast}
        />
      )}

      {/* Assets Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading assets…</div>
        ) : displayed.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="text-3xl">🗄️</div>
            <p className="font-medium text-gray-500">{search ? "No assets match your search" : "No assets yet"}</p>
            {!search && <p className="text-sm text-gray-400">Add assets individually or use Bulk Add.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f0f4ff] border-b border-blue-100">
                <tr>
                  {["Serial Number", "Site Name", "City", "Customer", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#1a2f5e] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {displayed.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-[#1a2f5e]">{a.serial}</td>
                    <td className="px-4 py-3 text-gray-700">{a.site}</td>
                    <td className="px-4 py-3">
                      {a.city
                        ? <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{a.city}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.customer || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <button
                          onClick={() => { setEditAsset(a); setShowModal(true); }}
                          className="text-[#1a2f5e] hover:text-[#c9a84c] text-xs font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(a.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
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
            <h3 className="font-bold text-[#1a2f5e] text-lg mb-2">Delete Asset?</h3>
            <p className="text-gray-500 text-sm mb-5">This will remove the asset from the database. Orders referencing this serial will not be affected.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-outline">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Modal */}
      {showModal && (
        <AssetModal
          asset={editAsset}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAssets(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
