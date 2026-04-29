"use client";
import { useState, useRef, useEffect } from "react";
import type { Asset } from "@/lib/supabase";

type Props = {
  value: string;
  onChange: (val: string) => void;
  onSelect: (asset: Asset) => void;
  placeholder?: string;
  autoFocus?: boolean;
  allowNew?: boolean;
};

function DbIcon({ loading }: { loading: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 transition-colors ${loading ? "text-[#1a2f5e] animate-pulse" : "text-gray-300"}`}
      fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5" />
    </svg>
  );
}

export default function SerialSearch({ value, onChange, onSelect, placeholder, autoFocus, allowNew }: Props) {
  const [all, setAll]             = useState<Asset[]>([]);
  const [filtered, setFiltered]   = useState<Asset[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showDrop, setShowDrop]   = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function loadAll() {
    if (all.length > 0) return all;
    setLoading(true);
    try {
      const r    = await fetch("/api/assets");
      const json = await r.json();
      const list: Asset[] = Array.isArray(json) ? json : [];
      setAll(list);
      return list;
    } finally {
      setLoading(false);
    }
  }

  async function handleFocus() {
    const list = await loadAll();
    const q = value.trim().toLowerCase();
    setFiltered(q ? list.filter((a) => a.serial.toLowerCase().includes(q) || a.site.toLowerCase().includes(q)) : list);
    setShowDrop(true);
  }

  function handleChange(val: string) {
    onChange(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = val.trim().toLowerCase();
      setFiltered(q ? all.filter((a) => a.serial.toLowerCase().includes(q) || a.site.toLowerCase().includes(q)) : all);
      setShowDrop(true);
    }, 150);
  }

  function handleSelect(a: Asset) {
    onSelect(a);
    setShowDrop(false);
  }

  const notFound = !loading && showDrop && filtered.length === 0 && all.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className="input pr-8"
          placeholder={placeholder ?? "Type serial number…"}
          value={value}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <DbIcon loading={loading} />
        </span>
      </div>

      {showDrop && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {notFound ? (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">No results</div>
          ) : (
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onMouseDown={() => handleSelect(a)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <span className="font-semibold text-[#1a2f5e]">{a.serial}</span>
                <span className="text-gray-300 mx-1.5">—</span>
                <span className="text-gray-600">{a.site}</span>
                {a.city && (
                  <>
                    <span className="text-gray-300 mx-1.5">—</span>
                    <span className="text-gray-500 text-xs">{a.city}</span>
                  </>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {!allowNew && !showDrop && value.trim() && all.length > 0 &&
        !all.some((a) => a.serial.toLowerCase() === value.trim().toLowerCase()) && (
        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Serial not found — add it in{" "}
          <strong className="font-semibold">Settings &gt; Assets</strong>
        </p>
      )}
    </div>
  );
}
