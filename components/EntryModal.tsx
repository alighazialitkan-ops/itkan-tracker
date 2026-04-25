"use client";
import { useState, useEffect } from "react";
import { CITIES, CITY_NAMES } from "@/lib/constants";
import { recordEngineerUsage } from "@/lib/utils";
import EngineerSearch from "./EngineerSearch";
import type { Entry } from "@/lib/supabase";

type EntryModalProps = {
  entry?: Entry | null;
  onSave: (entry: Partial<Entry>) => Promise<void>;
  onClose: () => void;
};

const today = new Date().toISOString().split("T")[0];

export default function EntryModal({ entry, onSave, onClose }: EntryModalProps) {
  const [date, setDate] = useState(entry?.date ?? today);
  const [city, setCity] = useState(entry?.city ?? "");
  const [engineers, setEngineers] = useState<string[]>(entry?.engineers ?? [""]);
  const [km, setKm] = useState<number>(entry?.km ?? 0);
  const [weight, setWeight] = useState<number>(entry?.weight ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (city && CITIES[city] !== undefined && !entry) {
      setKm(CITIES[city]);
    }
  }, [city, entry]);

  function addEngineer() {
    if (engineers.length < 10) setEngineers([...engineers, ""]);
  }

  function removeEngineer(i: number) {
    setEngineers(engineers.filter((_, idx) => idx !== i));
  }

  function updateEngineer(i: number, v: string) {
    const updated = [...engineers];
    updated[i] = v;
    setEngineers(updated);
  }

  async function handleSave() {
    setError("");
    if (!date) return setError("Date is required");
    if (!city) return setError("City is required");
    const filledEngineers = engineers.filter((e) => e.trim());
    if (filledEngineers.length === 0) return setError("At least one engineer is required");

    setSaving(true);
    recordEngineerUsage(filledEngineers);
    await onSave({ date, city, engineers: filledEngineers, km, weight });
    setSaving(false);
  }

  const selectedEngineers = engineers.filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1a2f5e] text-lg">{entry ? "Edit Entry" : "Add Entry"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Weight Score (1-9)</label>
              <input type="number" className="input" min={1} max={9} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City / Status</label>
              <select
                className="input"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (CITIES[e.target.value] !== undefined) setKm(CITIES[e.target.value]);
                }}
              >
                <option value="">Select city…</option>
                {CITY_NAMES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">KM</label>
              <input type="number" className="input" min={0} value={km} onChange={(e) => setKm(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="label">Engineers ({engineers.filter(Boolean).length}/10)</label>
            <div className="space-y-2">
              {engineers.map((eng, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-1">
                    <EngineerSearch
                      value={eng}
                      onChange={(v) => updateEngineer(i, v)}
                      exclude={selectedEngineers.filter((_, idx) => idx !== i)}
                      placeholder={`Engineer ${i + 1}`}
                      autoFocus={i === 0 && !entry}
                    />
                  </div>
                  {engineers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEngineer(i)}
                      className="text-red-400 hover:text-red-600 text-xl w-8 h-9 flex items-center justify-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {engineers.length < 10 && (
              <button
                type="button"
                onClick={addEngineer}
                className="mt-2 text-sm text-[#1a2f5e] font-medium hover:underline flex items-center gap-1"
              >
                <span className="text-lg">+</span> Add Engineer ({engineers.length}/10)
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
