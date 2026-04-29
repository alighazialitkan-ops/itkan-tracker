"use client";
import { useState, useRef, useEffect } from "react";
import { ENGINEERS } from "@/lib/constants";
import { getTopFrequentEngineers } from "@/lib/utils";

let _engineerCache: string[] | null = null;

export function invalidateEngineerCache() {
  _engineerCache = null;
}

type EngineerSearchProps = {
  value: string;
  onChange: (v: string) => void;
  exclude?: string[];
  placeholder?: string;
  autoFocus?: boolean;
};

export default function EngineerSearch({ value, onChange, exclude = [], placeholder = "Search engineer…", autoFocus }: EngineerSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [engineerList, setEngineerList] = useState<string[]>(_engineerCache ?? ENGINEERS);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (_engineerCache) { setEngineerList(_engineerCache); return; }
    fetch("/api/engineers")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const names = (data as { name: string }[]).map((e) => e.name).sort();
          _engineerCache = names;
          setEngineerList(names);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const frequent = getTopFrequentEngineers(10).filter(
    (e) => !exclude.includes(e) && e.toLowerCase().includes(query.toLowerCase())
  );

  const filtered = engineerList.filter(
    (e) => !exclude.includes(e) && e.toLowerCase().includes(query.toLowerCase())
  );

  const frequentSet = new Set(frequent);
  const rest = filtered.filter((e) => !frequentSet.has(e));

  function select(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  function highlightMatch(text: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <strong className="text-[#1a2f5e]">{text.slice(idx, idx + query.length)}</strong>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        className="input"
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange(""); }}
        onFocus={() => setOpen(true)}
      />
      {open && (filtered.length > 0 || frequent.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {frequent.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 sticky top-0">⭐ Frequent</div>
              {frequent.map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onMouseDown={() => select(eng)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 bg-yellow-50/50"
                >
                  {highlightMatch(eng)}
                </button>
              ))}
            </>
          )}
          {rest.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">All engineers</div>
              {rest.map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onMouseDown={() => select(eng)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                >
                  {highlightMatch(eng)}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
