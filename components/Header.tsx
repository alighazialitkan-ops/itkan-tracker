"use client";
import { useState } from "react";
import AdminModal from "./AdminModal";
import ShareModal from "./ShareModal";

type HeaderProps = {
  isAdmin: boolean;
  isViewOnly: boolean;
  onAdminChange: (v: boolean) => void;
};

export default function Header({ isAdmin, isViewOnly, onAdminChange }: HeaderProps) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [showShare, setShowShare] = useState(false);

  return (
    <>
      <header
        className="w-full text-white px-4 py-3"
        style={{ background: "linear-gradient(135deg, #1a2f5e 0%, #243d7a 100%)" }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[#c9a84c] font-bold text-base sm:text-lg leading-tight truncate">
              AL-ITKAN For Commercial Agencies
            </div>
            <div className="text-white/70 text-xs sm:text-sm leading-tight">
              Engineers Load Tracking System
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isViewOnly && (
              <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                View Only
              </span>
            )}
            {isAdmin && (
              <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                Admin
              </span>
            )}

            <button
              onClick={() => setShowShare(true)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Share"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>

            <button
              onClick={() => setShowAdmin(true)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title={isAdmin ? "Admin Panel" : "Admin Login"}
            >
              {isAdmin ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 9a2 2 0 104 0 2 2 0 00-4 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {showAdmin && (
        <AdminModal
          isAdmin={isAdmin}
          onClose={() => setShowAdmin(false)}
          onAdminChange={(v) => { onAdminChange(v); setShowAdmin(false); }}
        />
      )}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </>
  );
}
