"use client";
import { useState, useEffect, useRef } from "react";
import SerialSearch from "./SerialSearch";
import EngineerSearch from "./EngineerSearch";
import Toast from "./Toast";
import type { Asset } from "@/lib/supabase";
import { DAY_NAMES, CITY_NAMES } from "@/lib/constants";
import { recordEngineerUsage } from "@/lib/utils";

/* ── Types ── */
type JobType = "J" | "N" | "U" | "S";
type SubType = "J" | "N" | "U";
type UpdateDateMode = "today" | "today-created" | "tomorrow" | "tomorrow-created";

const TYPE_LABEL: Record<JobType, string> = { J: "Job", N: "Note", U: "Update", S: "SubTicket" };
const TYPE_COLOR: Record<JobType, string> = {
  J: "bg-green-100 text-green-700",
  N: "bg-blue-100 text-blue-700",
  U: "bg-amber-100 text-amber-700",
  S: "bg-purple-100 text-purple-700",
};

interface JobEntry {
  id: string;
  date: string;
  created: boolean;
  isUpdate: boolean;
  type: JobType;
  subType: SubType;
  subTicketNo: string;
  serial: string;
  city: string;
  site: string;
  machine: string;
  engineers: string[];
  car: string;
  description: string;
}

/* ── Predefined descriptions ── */
const PREDEFINED_DESCRIPTIONS = [
  "PM Visit", "Corrective Maintenance", "Installation", "Commissioning",
  "Calibration", "Training", "Software Update", "Parts Replacement",
  "Hardware Repair", "Network Configuration", "System Check",
  "Remote Support", "On-site Support", "Follow Up", "Assessment",
  "Customer Complaint", "UPS Maintenance", "Generator Check",
  "Preventive Maintenance", "Annual Maintenance", "Quarterly Maintenance",
  "Monthly Maintenance", "Weekly Maintenance", "Daily Check",
  "Acceptance Test", "Quality Control", "Image Quality Check", "Dosimetry",
  "Acceptance Protocol", "Site Survey", "Application Training",
  "Clinical Training", "Technical Training", "Operator Training",
  "Parts Delivery", "Parts Order Follow Up", "Parts Installation",
  "Consumable Replacement", "Cooling Water Check", "Temperature Check",
  "Alignment Check", "Safety Check", "Electrical Check", "Mechanical Check",
  "Software Installation", "Database Backup", "System Migration", "Upgrade",
  "Decommission", "Relocation", "Handover", "Documentation", "Report Submission",
  "Remote Diagnosis", "Technical Consultation", "Engineering Review",
  "Warranty Visit", "Contract Visit", "Emergency Visit", "Urgent Visit",
  "Scheduled Visit", "Imaging Test", "Phantom Test", "QA Test",
  "Compliance Check", "Startup", "Shutdown", "Reboot", "Reset",
  "Log Review", "Fault Analysis", "Root Cause Analysis", "Service Report",
  "Monitoring", "Parts Collection", "Parts Return", "Demo", "Audit",
  "Detector Replacement", "Tube Replacement", "Coil Replacement",
  "Table Motor Replacement", "Collimator Service", "Gantry Service",
  "High Voltage Service", "Cooling System Service", "Chiller Service",
  "Air Conditioning Service", "Sensor Replacement",
  "Water Leak Investigation", "Power Issue", "Error Investigation",
  "Standby Visit", "Supervision", "Loan Equipment", "Evaluation",
];

/* ── Utils ── */
function todayStr() { return new Date().toISOString().split("T")[0]; }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatHeader(dateStr: string, created: boolean): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = DAY_NAMES[d.getDay()];
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${day} ${dd}.${mm}.${yyyy}${created ? " (Created)" : ""}`;
}

function cleanSite(site: string): string {
  return site
    .replace(/^\d+\s*-\s*/i, "")
    .replace(/^IQ\d+\s*/i, "")
    .trim();
}

function guessMachine(serial: string): string {
  const n = parseInt(serial.replace(/\D/g, ""), 10);
  if (isNaN(n) || n === 0) return "";
  return n >= 4000 ? "Truebeam" : "Clinac";
}

function formatEngineers(engineers: string[], car: string): string {
  const parts = [...engineers.filter(Boolean), ...(car.trim() ? [car.trim()] : [])];
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `(${parts.join(" + ")})`;
}

function formatEntry(e: JobEntry): string {
  const engs = formatEngineers(e.engineers, e.car);
  const machineSerial = [e.machine, e.serial].filter(Boolean).join(" ");
  const tail = [engs, e.city, cleanSite(e.site), machineSerial, e.description].filter(Boolean);

  if (e.type === "S") {
    return [`SubTicket #${e.subTicketNo} - ${TYPE_LABEL[e.subType]}`, ...tail].join(" - ");
  }

  let typeStr = TYPE_LABEL[e.type];
  if (e.isUpdate && e.created) typeStr = "Update (Created)";
  return [typeStr, ...tail].join(" - ");
}

function generateReport(entries: JobEntry[]): string {
  if (entries.length === 0) return "";

  const dateEntries = entries.filter(e => !e.isUpdate);
  const updateEntries = entries.filter(e => e.isUpdate);
  const sections: string[] = [];

  if (dateEntries.length > 0) {
    const groups = new Map<string, JobEntry[]>();
    for (const e of dateEntries) {
      const key = `${e.date}|${e.created}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const [date, createdStr] = key.split("|");

      /* Sort J before N before U; S stays at entered position */
      const ORDER: Record<JobType, number> = { J: 0, N: 1, U: 2, S: -1 };
      const sIdx = new Set(group.map((e, i) => e.type === "S" ? i : -1).filter(i => i >= 0));
      const nonS = group.filter(e => e.type !== "S").sort((a, b) => ORDER[a.type] - ORDER[b.type]);
      const ordered: JobEntry[] = [];
      let ni = 0;
      for (let i = 0; i < group.length; i++) {
        ordered.push(sIdx.has(i) ? group[i] : nonS[ni++]);
      }

      sections.push(formatHeader(date, createdStr === "true") + "\n\n" + ordered.map(formatEntry).join("\n"));
    }
  }

  if (updateEntries.length > 0) {
    sections.push(updateEntries.map(formatEntry).join("\n"));
  }

  return sections.join("\n\n\n");
}

/* ── LocalStorage helpers ── */
function loadEntries(): JobEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("jobsEntries") ?? "[]"); } catch { return []; }
}
function saveEntries(e: JobEntry[]) { localStorage.setItem("jobsEntries", JSON.stringify(e)); }

function getRecentCars(): string[] {
  try { return JSON.parse(localStorage.getItem("recentCars") ?? "[]"); } catch { return []; }
}
function addRecentCar(car: string) {
  if (!car.trim()) return;
  const r = getRecentCars().filter(c => c !== car.trim());
  localStorage.setItem("recentCars", JSON.stringify([car.trim(), ...r].slice(0, 20)));
}

function getRecentDescriptions(): string[] {
  try { return JSON.parse(localStorage.getItem("recentDescriptions") ?? "[]"); } catch { return []; }
}
function addRecentDescription(d: string) {
  if (!d.trim()) return;
  const r = getRecentDescriptions().filter(x => x !== d.trim());
  localStorage.setItem("recentDescriptions", JSON.stringify([d.trim(), ...r].slice(0, 30)));
}

/* ── Report history ── */
interface SavedReport {
  id: string;
  text: string;
  createdAt: string;
}
function loadReports(): SavedReport[] {
  try { return JSON.parse(localStorage.getItem("jobsReports") ?? "[]"); } catch { return []; }
}
function saveReports(r: SavedReport[]) { localStorage.setItem("jobsReports", JSON.stringify(r)); }
function addReport(text: string): SavedReport[] {
  const updated = [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...loadReports()];
  saveReports(updated);
  return updated;
}

const GEO_CITIES = CITY_NAMES.filter(c => !["Standby", "Off", "Over-night", "Half-Day"].includes(c));

/* ── CityInput ── */
function CityInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = value.toLowerCase();
  const filtered = GEO_CITIES.filter(c => !q || c.toLowerCase().startsWith(q) || c.toLowerCase().includes(q));

  return (
    <div ref={ref} className="relative">
      <input type="text" className="input" value={value} placeholder="City…"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(c => (
            <button key={c} type="button" onMouseDown={() => { onChange(c); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${value === c ? "bg-blue-50 font-medium text-[#1a2f5e]" : ""}`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CarInput ── */
function CarInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setRecent(getRecentCars()); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = recent.filter(c => c.toLowerCase().includes(value.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <input type="text" className="input" value={value} placeholder="Car plate or ID…"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
          {filtered.map(c => (
            <button key={c} type="button" onMouseDown={() => { onChange(c); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50">{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── DescriptionInput ── */
function DescriptionInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const q = value.toLowerCase();
  const recent = getRecentDescriptions().filter(d => !q || d.toLowerCase().includes(q));
  const recentSet = new Set(recent);
  const predefined = PREDEFINED_DESCRIPTIONS.filter(d => !recentSet.has(d) && (!q || d.toLowerCase().includes(q)));

  return (
    <div ref={ref} className="relative">
      <input type="text" className="input" value={value} placeholder="Description…"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && (recent.length > 0 || predefined.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {recent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 sticky top-0">Recent</div>
              {recent.map(d => (
                <button key={d} type="button" onMouseDown={() => { onChange(d); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 bg-yellow-50/30">{d}</button>
              ))}
            </>
          )}
          {predefined.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">Predefined</div>
              {predefined.map(d => (
                <button key={d} type="button" onMouseDown={() => { onChange(d); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50">{d}</button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── EntryCard ── */
function EntryCard({ entry, onEdit, onDelete }: { entry: JobEntry; onEdit: () => void; onDelete: () => void }) {
  const engs = [...entry.engineers.filter(Boolean), ...(entry.car ? [entry.car] : [])].join(" + ");
  const machineSerial = [entry.machine, entry.serial].filter(Boolean).join(" ");
  return (
    <div className="px-4 py-3 flex items-start gap-3 group hover:bg-gray-50/60 transition-colors">
      <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${TYPE_COLOR[entry.type]}`}>
        {entry.type === "S" ? `Sub#${entry.subTicketNo}` : TYPE_LABEL[entry.type]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#1a2f5e] truncate">
          {[entry.city, entry.site, machineSerial].filter(Boolean).join(" · ") || "—"}
        </div>
        {engs && <div className="text-xs text-gray-500 mt-0.5 truncate">{engs}</div>}
        {entry.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{entry.description}</div>}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 font-medium">Del</button>
      </div>
    </div>
  );
}

/* ── AddEntryModal ── */
function AddEntryModal({
  entry, onSave, onClose,
}: {
  entry: JobEntry | null;
  onSave: (data: Omit<JobEntry, "id" | "date" | "created" | "isUpdate">) => void;
  onClose: () => void;
}) {
  const [type, setType]           = useState<JobType>(entry?.type ?? "J");
  const [subType, setSubType]     = useState<SubType>(entry?.subType ?? "J");
  const [subTicketNo, setSubNo]   = useState(entry?.subTicketNo ?? "");
  const [serial, setSerial]       = useState(entry?.serial ?? "");
  const [city, setCity]           = useState(entry?.city ?? "");
  const [site, setSite]           = useState(entry?.site ?? "");
  const [machine, setMachine]     = useState(entry?.machine ?? "");
  const [engineers, setEngineers] = useState<string[]>(entry?.engineers?.length ? entry.engineers : [""]);
  const [car, setCar]             = useState(entry?.car ?? "");
  const [description, setDesc]    = useState(entry?.description ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const map: Record<string, JobType> = { j: "J", n: "N", u: "U", s: "S" };
      if (map[e.key?.toLowerCase()]) setType(map[e.key.toLowerCase()]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onAssetSelect(a: Asset) {
    setSerial(a.serial);
    setCity(a.city ?? "");
    setSite(cleanSite(a.site ?? ""));
    setMachine(guessMachine(a.serial));
  }

  function handleSave() {
    onSave({ type, subType, subTicketNo, serial, city, site, machine,
      engineers: engineers.filter(Boolean), car, description });
  }

  const preview = formatEntry({
    id: "", date: "", created: false, isUpdate: false,
    type, subType, subTicketNo, serial, city, site, machine,
    engineers: engineers.filter(Boolean), car, description,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-100">
          <h2 className="font-bold text-[#1a2f5e]">{entry ? "Edit Entry" : "Add Entry"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">

          {/* Type */}
          <div>
            <label className="label">Type <span className="text-gray-400 font-normal normal-case">press J / N / U / S</span></label>
            <div className="flex gap-1.5">
              {(["J", "N", "U", "S"] as JobType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    type === t ? TYPE_COLOR[t] + " border-current" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                  }`}>
                  {t} · {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* SubTicket fields */}
          {type === "S" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ticket #</label>
                <input type="text" className="input" value={subTicketNo} placeholder="12345"
                  onChange={e => setSubNo(e.target.value)} />
              </div>
              <div>
                <label className="label">Sub-type</label>
                <div className="flex gap-1">
                  {(["J", "N", "U"] as SubType[]).map(t => (
                    <button key={t} type="button" onClick={() => setSubType(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                        subType === t ? TYPE_COLOR[t] + " border-current" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}>
                      {TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Serial */}
          <div>
            <label className="label">Serial → auto-fills city / site / machine</label>
            <SerialSearch value={serial} onChange={setSerial} onSelect={onAssetSelect} allowNew
              placeholder="Type serial to search assets…" />
          </div>

          {/* City / Site / Machine */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">City</label>
              <CityInput value={city} onChange={setCity} />
            </div>
            <div>
              <label className="label">Site</label>
              <input type="text" className="input" value={site} placeholder="Site"
                onChange={e => setSite(e.target.value)} />
            </div>
            <div>
              <label className="label">Machine</label>
              <select className="input" value={machine} onChange={e => setMachine(e.target.value)}>
                <option value="">—</option>
                <option value="Truebeam">Truebeam</option>
                <option value="Clinac">Clinac</option>
              </select>
            </div>
          </div>

          {/* Engineers */}
          <div>
            <label className="label">Engineers ({engineers.filter(Boolean).length})</label>
            <div className="space-y-2">
              {engineers.map((eng, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <EngineerSearch
                      value={eng}
                      onChange={v => { const n = [...engineers]; n[i] = v; setEngineers(n); }}
                      exclude={engineers.filter((_, idx) => idx !== i).filter(Boolean)}
                      placeholder={`Engineer ${i + 1}`}
                    />
                  </div>
                  {engineers.length > 1 && (
                    <button type="button" onClick={() => setEngineers(engineers.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-xl w-8 h-9 flex items-center justify-center">×</button>
                  )}
                </div>
              ))}
            </div>
            {engineers.length < 10 && (
              <button type="button" onClick={() => setEngineers([...engineers, ""])}
                className="mt-2 text-sm text-[#1a2f5e] font-medium hover:underline flex items-center gap-1">
                <span className="text-lg">+</span> Add Engineer
              </button>
            )}
          </div>

          {/* Car */}
          <div>
            <label className="label">Car</label>
            <CarInput value={car} onChange={setCar} />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <DescriptionInput value={description} onChange={setDesc} />
          </div>
        </div>

        {/* Preview line */}
        <div className="mx-4 mb-3 p-3 bg-[#f0f4ff] rounded-xl text-xs text-gray-700 font-mono leading-relaxed break-all">
          {preview || <span className="text-gray-400 italic">preview…</span>}
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} className="btn-primary">Save Entry</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Jobs component ── */
export default function Jobs() {
  const [entries, setEntries]           = useState<JobEntry[]>([]);
  const [pageMode, setPageMode]         = useState<"date" | "update">("date");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedCreated, setCreated]   = useState(false);
  const [updateMode, setUpdateMode]     = useState<UpdateDateMode>("today");
  const [showModal, setShowModal]       = useState(false);
  const [editEntry, setEditEntry]       = useState<JobEntry | null>(null);
  const [showReport, setShowReport]     = useState(false);
  const [reportText, setReportText]     = useState("");
  const [copied, setCopied]             = useState(false);
  const [showHistory, setShowHistory]   = useState(false);
  const [history, setHistory]           = useState<SavedReport[]>([]);
  const [historyView, setHistoryView]   = useState<SavedReport | null>(null);
  const [toast, setToast]               = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => { setEntries(loadEntries()); setHistory(loadReports()); }, []);

  function persist(updated: JobEntry[]) { setEntries(updated); saveEntries(updated); }

  function resolveContext() {
    if (pageMode === "update") {
      const isCreated  = updateMode.includes("created");
      const isTomorrow = updateMode.includes("tomorrow");
      return { date: isTomorrow ? tomorrowStr() : todayStr(), created: isCreated, isUpdate: true };
    }
    return { date: selectedDate, created: selectedCreated, isUpdate: false };
  }

  function handleSave(data: Omit<JobEntry, "id" | "date" | "created" | "isUpdate">) {
    if (editEntry) {
      persist(entries.map(e => e.id === editEntry.id ? { ...e, ...data } : e));
      setToast({ message: "Entry updated", type: "success" });
    } else {
      const ctx = resolveContext();
      persist([...entries, { ...data, id: crypto.randomUUID(), ...ctx }]);
      setToast({ message: "Entry added", type: "success" });
    }
    recordEngineerUsage(data.engineers);
    if (data.car) addRecentCar(data.car);
    if (data.description) addRecentDescription(data.description);
    setShowModal(false);
    setEditEntry(null);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    persist(entries.filter(e => e.id !== id));
  }

  function openEdit(e: JobEntry) { setEditEntry(e); setShowModal(true); }
  function openAdd()  { setEditEntry(null); setShowModal(true); }

  function handleGenerate() {
    const text = generateReport(entries);
    setReportText(text);
    setShowReport(true);
    const updated = addReport(text);
    setHistory(updated);
  }

  function handleDeleteReport(id: string) {
    const updated = history.filter(r => r.id !== id);
    setHistory(updated);
    saveReports(updated);
    if (historyView?.id === id) setHistoryView(null);
  }

  async function handleCopyReport(text: string) {
    await navigator.clipboard.writeText(text);
    setToast({ message: "Copied!", type: "success" });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ── Grouped display data ── */
  const updateEntries = entries.filter(e => e.isUpdate);
  const dateEntries   = entries.filter(e => !e.isUpdate);
  const groups        = new Map<string, JobEntry[]>();
  for (const e of dateEntries) {
    const key = `${e.date}|${e.created}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">

      {/* Header */}
      <div className="card flex items-center justify-between py-3">
        <div>
          <h1 className="font-bold text-[#1a2f5e] text-lg">JOBS</h1>
          <p className="text-xs text-gray-400">WhatsApp Report Generator</p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={() => setShowHistory(true)}
              className="text-xs text-[#1a2f5e] hover:text-[#243d7a] px-2 py-1 rounded border border-blue-200 hover:border-blue-400 transition-colors">
              History ({history.length})
            </button>
          )}
          {entries.length > 0 && (
            <>
              <button onClick={handleGenerate} className="btn-primary text-sm">Generate Report</button>
              <button
                onClick={() => { if (confirm("Clear all entries?")) persist([]); }}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-100 hover:border-red-300 transition-colors">
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode + controls */}
      <div className="card space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-2">
          {(["date", "update"] as const).map(m => (
            <button key={m} onClick={() => setPageMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                pageMode === m ? "bg-[#1a2f5e] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {m === "date" ? "Date Mode" : "Update Mode"}
            </button>
          ))}
        </div>

        {/* Date mode controls */}
        {pageMode === "date" && (
          <div className="flex items-center gap-3">
            <input type="date" className="input flex-1" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)} />
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <input type="checkbox" className="w-4 h-4" checked={selectedCreated}
                onChange={e => setCreated(e.target.checked)} />
              Created
            </label>
            {selectedDate && (
              <span className="text-sm font-medium text-[#1a2f5e] whitespace-nowrap">
                {DAY_NAMES[new Date(selectedDate + "T00:00:00").getDay()]}
              </span>
            )}
          </div>
        )}

        {/* Update mode controls */}
        {pageMode === "update" && (
          <div className="grid grid-cols-2 gap-2">
            {([
              ["today",          "Update for today"],
              ["today-created",  "Update for today (Created)"],
              ["tomorrow",       "Update for tomorrow"],
              ["tomorrow-created","Update for tomorrow (Created)"],
            ] as [UpdateDateMode, string][]).map(([m, label]) => (
              <button key={m} onClick={() => setUpdateMode(m)}
                className={`py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
                  updateMode === m
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <button onClick={openAdd} className="btn-primary w-full text-sm">+ Add Entry</button>
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <div className="font-medium">No entries yet</div>
          <div className="text-sm mt-1">Add entries to generate a WhatsApp report.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Date groups */}
          {sortedGroups.map(([key, group]) => {
            const [date, createdStr] = key.split("|");
            return (
              <div key={key} className="card p-0 overflow-hidden">
                <div className="bg-[#f0f4ff] border-b border-blue-100 px-4 py-2.5 flex items-center gap-2">
                  <span className="font-semibold text-[#1a2f5e] text-sm">
                    {formatHeader(date, createdStr === "true")}
                  </span>
                  <span className="text-gray-400 text-xs">({group.length})</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {group.map(e => (
                    <EntryCard key={e.id} entry={e}
                      onEdit={() => openEdit(e)} onDelete={() => handleDelete(e.id)} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Update entries */}
          {updateEntries.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center gap-2">
                <span className="font-semibold text-amber-700 text-sm">Updates</span>
                <span className="text-amber-400 text-xs">({updateEntries.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {updateEntries.map(e => (
                  <EntryCard key={e.id} entry={e}
                    onEdit={() => openEdit(e)} onDelete={() => handleDelete(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <AddEntryModal entry={editEntry} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditEntry(null); }} />
      )}

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-blue-100">
              <h2 className="font-bold text-[#1a2f5e] text-lg">WhatsApp Report</h2>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                    copied ? "bg-green-100 text-green-700" : "bg-[#1a2f5e] text-white hover:bg-[#243d7a]"
                  }`}>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={() => setShowReport(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
            </div>
            <div className="p-5">
              <pre className="bg-[#f0f4ff] rounded-xl p-4 text-sm whitespace-pre-wrap font-mono text-gray-800 max-h-[60vh] overflow-y-auto border border-blue-100 leading-relaxed">
                {reportText || "No entries."}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-blue-100">
              <h2 className="font-bold text-[#1a2f5e] text-lg">
                {historyView ? "Report" : `Report History (${history.length})`}
              </h2>
              <div className="flex items-center gap-2">
                {historyView && (
                  <>
                    <button onClick={() => handleCopyReport(historyView.text)}
                      className="text-sm px-3 py-1.5 rounded-lg font-medium bg-[#1a2f5e] text-white hover:bg-[#243d7a] transition-colors">
                      Copy
                    </button>
                    <button onClick={() => setHistoryView(null)}
                      className="text-sm px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      ← Back
                    </button>
                  </>
                )}
                <button onClick={() => { setShowHistory(false); setHistoryView(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
            </div>
            <div className="p-5">
              {historyView ? (
                <pre className="bg-[#f0f4ff] rounded-xl p-4 text-sm whitespace-pre-wrap font-mono text-gray-800 max-h-[60vh] overflow-y-auto border border-blue-100 leading-relaxed">
                  {historyView.text}
                </pre>
              ) : history.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No saved reports yet.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {history.map(r => {
                    const d = new Date(r.createdAt);
                    const label = d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                    const preview = r.text.split("\n")[0];
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group">
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setHistoryView(r)}>
                          <div className="text-xs font-semibold text-[#1a2f5e]">{label}</div>
                          <div className="text-xs text-gray-400 truncate mt-0.5">{preview}</div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => handleCopyReport(r.text)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                            Copy
                          </button>
                          <button onClick={() => handleDeleteReport(r.id)}
                            className="text-xs text-red-400 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                            Del
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
