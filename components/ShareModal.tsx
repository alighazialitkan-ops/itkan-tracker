"use client";
import { useState } from "react";

type ShareModalProps = { onClose: () => void };

export default function ShareModal({ onClose }: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const links = [
    { label: "Edit Link (Managers)", url: base, desc: "Full edit access" },
    { label: "View-Only Link", url: `${base}?mode=view`, desc: "Read-only access" },
  ];

  async function copy(url: string, key: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1a2f5e] text-lg">Share</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          {links.map((link) => (
            <div key={link.url} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-[#1a2f5e]">{link.label}</span>
                <span className="text-xs text-gray-500">{link.desc}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link.url}
                  className="input flex-1 text-xs bg-gray-50"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={() => copy(link.url, link.url)}
                  className="shrink-0 btn-primary text-xs px-3 py-2"
                >
                  {copied === link.url ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
