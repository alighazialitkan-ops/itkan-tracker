"use client";
import { useState, useEffect } from "react";
import { CITIES, CITY_NAMES } from "@/lib/constants";
import { recordEngineerUsage } from "@/lib/utils";
import EngineerSearch from "./EngineerSearch";
import type { DailyLogDetail } from "@/lib/supabase";

type EntryModalProps = {
  detail?: DailyLogDetail | null;
  defaultDate?: string;
  /** When true renders just the card with no backdrop — parent provides positioning */
  bare?: boolean;
  onSave: (detail: Partial<DailyLogDetail>) => Promise<void>;
  onClose: () => void;
};

const today = new Date().toISOString().split("T")[0];

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export default function EntryModal({ detail, defaultDate, bare = false, onSave, onClose }: EntryModalProps) {
  const initDate = detail?.start_date ?? defaultDate ?? today;
  const [startDate, setStartDate] = useState(initDate);
  const [endDate, setEndDate] = useState(detail?.end_date ?? defaultDate ?? today);
  const [city, setCity] = useState(detail?.city ?? "");
  const [engineers, setEngineers] = useState<string[]>(detail?.engineers ?? [""]);
  const [km, setKm] = useState<number>(detail?.km ?? 0);
  const [weight, setWeight] = useState<number>(detail?.weight ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (city && CITIES[city] !== undefined && !detail) {
      setKm(CITIES[city]);
    }
  }, [city, detail]);

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
    if (!startDate) return setError("Start date is required");
    if (!city) return setError("City is required");
    const filledEngineers = engineers.filter((e) => e.trim());
    if (filledEngineers.length === 0) return setError("At least one engineer is required");
    if (endDate && endDate < startDate) return setError("End date cannot be before start date");

    setSaving(true);
    recordEngineerUsage(filledEngineers);
    await onSave({
      start_date: startDate,
      end_date: endDate && endDate >= startDate ? endDate : startDate,
      city,
      engineers: filledEngineers,
      km,
      weight: roundToHalf(weight),
    });
    setSaving(false);
  }

  const selectedEngineers = engineers.filter(Boolean);
  const isMultiDay = endDate && endDate !== startDate;

  const card = (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
      <div className="flex items-center justify-between p-5 border-b border-blue-100">
        <h2 className="font-bold text-[#1a2f5e] text-lg">{detail ? "Edit Entry" : "Add Entry"}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
      </div>

      <div className="p-5 space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="label">
              End Date <span className="text-gray-400 font-normal text-xs">(multi-day)</span>
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {isMultiDay && (
          <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
            Multi-day: KM = total for the whole period · Weight = average across all days (rounded to nearest 0.5)
          </div>
        )}

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
            <input
              type="number"
              className="input"
              min={0}
              value={km}
              onChange={(e) => setKm(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label">
            Weight <span className="text-gray-400 font-normal text-xs">(rounds to nearest 0.5)</span>
          </label>
          <input
            type="number"
            className="input"
            min={0}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
          />
          {weight > 0 && weight !== roundToHalf(weight) && (
            <div className="text-xs text-gray-500 mt-1">Will save as: {roundToHalf(weight)}</div>
          )}
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
                    autoFocus={i === 0 && !detail}
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
  );

  if (bare) return card;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      {card}
    </div>
  );
}
