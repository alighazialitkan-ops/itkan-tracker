"use client";
import { useState } from "react";
import type { DailyLog, DailyLogDetail } from "@/lib/supabase";
import { CITY_BADGE_COLORS, DEFAULT_CITY_BADGE } from "@/lib/constants";
import { formatDateWithDay, formatShortDate } from "@/lib/utils";
import EntryModal from "./EntryModal";

type EditDayModalProps = {
  log: DailyLog;
  isViewOnly: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

function roundToHalf(v: number) { return Math.round(v * 2) / 2; }

export default function EditDayModal({ log, isViewOnly, onClose, onRefresh }: EditDayModalProps) {
  const [details, setDetails] = useState<DailyLogDetail[]>(log.details);
  const [editingDetail, setEditingDetail] = useState<DailyLogDetail | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  async function refreshDetails() {
    const r = await fetch(`/api/daily-logs?from=${log.date}&to=${log.date}`);
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) {
      setDetails(data[0].details);
    } else {
      // All details were removed — parent was auto-deleted
      onRefresh();
      onClose();
      return;
    }
    onRefresh();
  }

  async function handleSaveDetail(data: Partial<DailyLogDetail>) {
    if (editingDetail) {
      await fetch(`/api/daily-logs/details/${editingDetail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/daily-logs/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setEditingDetail(null);
    setAddingNew(false);
    await refreshDetails();
  }

  async function handleDeleteDetail(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/daily-logs/details/${id}`, { method: "DELETE" });
    await refreshDetails();
  }

  const totalKm = details.reduce((s, d) => s + Number(d.km), 0);
  const engSet = new Set(details.flatMap((d) => d.engineers));
  const avgWeight = details.length
    ? roundToHalf(details.reduce((s, d) => s + Number(d.weight), 0) / details.length)
    : 0;

  const showEntryForm = editingDetail !== null || addingNew;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-blue-100">
          <div>
            <h2 className="font-bold text-[#1a2f5e] text-lg">Edit Day</h2>
            <p className="text-sm text-gray-500 mt-0.5">{formatDateWithDay(log.date)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Detail list */}
        <div className="p-5 space-y-2 max-h-[52vh] overflow-y-auto">
          {details.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">No entries for this day</p>
          )}

          {details.map((detail) => {
            const badgeClass = CITY_BADGE_COLORS[detail.city] ?? DEFAULT_CITY_BADGE;
            const isMultiDay = detail.start_date && detail.end_date && detail.start_date !== detail.end_date;
            return (
              <div
                key={detail.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#f4f6fb] border-l-4 border-[#c9a84c]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${badgeClass}`}>
                      {detail.city}
                    </span>
                    {isMultiDay && (
                      <span className="text-xs text-gray-500">
                        {formatShortDate(detail.start_date)} → {formatShortDate(detail.end_date)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {detail.engineers.map((eng) => (
                      <span key={eng} className="bg-[#1a2f5e]/10 text-[#1a2f5e] text-xs px-2 py-0.5 rounded-full">
                        {eng}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                    <span className="font-medium text-[#1a2f5e]">{Number(detail.km).toLocaleString()} km</span>
                    <span>·</span>
                    <span className="bg-purple-100 text-purple-700 font-semibold px-1.5 py-0.5 rounded">
                      Weight {detail.weight}
                    </span>
                  </div>
                </div>

                {!isViewOnly && (
                  <div className="flex gap-2 shrink-0 pt-0.5">
                    <button
                      onClick={() => { setEditingDetail(detail); setAddingNew(false); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteDetail(detail.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add another city */}
        {!isViewOnly && (
          <div className="px-5 pb-3">
            <button
              onClick={() => { setAddingNew(true); setEditingDetail(null); }}
              className="w-full border-2 border-dashed border-[#c9a84c]/50 text-[#c9a84c] rounded-xl py-2.5 text-sm font-medium hover:border-[#c9a84c] hover:bg-[#c9a84c]/5 transition-colors"
            >
              + Add Another City
            </button>
          </div>
        )}

        {/* Totals footer */}
        <div className="border-t border-blue-100 px-5 py-3 bg-[#f8f9ff] rounded-b-2xl flex flex-wrap gap-5 text-sm">
          <div>
            <span className="font-bold text-[#1a2f5e]">{totalKm.toLocaleString()}</span>
            <span className="text-gray-500 text-xs ml-1">km total</span>
          </div>
          <div>
            <span className="font-bold text-purple-700">{avgWeight.toFixed(1)}</span>
            <span className="text-gray-500 text-xs ml-1">avg weight</span>
          </div>
          <div>
            <span className="font-bold text-green-700">{engSet.size}</span>
            <span className="text-gray-500 text-xs ml-1">engineers</span>
          </div>
          <div>
            <span className="font-bold text-[#1a2f5e]">{details.length}</span>
            <span className="text-gray-500 text-xs ml-1">{details.length === 1 ? "entry" : "entries"}</span>
          </div>
        </div>
      </div>

      {/* EntryModal stacked on top (z-[60] so it covers the EditDayModal) */}
      {showEntryForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <EntryModal
            key={editingDetail?.id ?? "new-in-day"}
            bare
            detail={editingDetail}
            defaultDate={log.date}
            onSave={handleSaveDetail}
            onClose={() => { setEditingDetail(null); setAddingNew(false); }}
          />
        </div>
      )}
    </div>
  );
}
