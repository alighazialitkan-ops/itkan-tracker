"use client";
import { useState, useEffect } from "react";
import MainLog from "./MainLog";
import Tracker from "./Tracker";
import Dashboard from "./Dashboard";
import Settings from "./Settings";
import Teams from "./Teams";
import AdminModal from "./AdminModal";
import ShareModal from "./ShareModal";

type Tab = "log" | "tracker" | "dashboard" | "settings" | "teams";

/* ─────────────────────────────────────────────
   SVG Icon components
───────────────────────────────────────────── */
function LogIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function TrackerIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TeamsIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function AdminIcon({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 9a2 2 0 104 0 2 2 0 00-4 0z" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ChevronIcon({ left }: { left: boolean }) {
  return (
    <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${left ? "" : "rotate-180"}`}
      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Main AppShell
───────────────────────────────────────────── */
export default function AppShell() {
  const [tab, setTab]               = useState<Tab>("log");
  const [isAdmin, setIsAdmin]       = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAdmin, setShowAdmin]   = useState(false);
  const [showShare, setShowShare]   = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("isAdmin")) setIsAdmin(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "view") setIsViewOnly(true);
    if (window.innerWidth < 1024) setCollapsed(true);
  }, []);

  function handleAdminChange(v: boolean) {
    setIsAdmin(v);
    if (!v && tab === "teams") setTab("log");
  }

  function navigate(t: Tab) {
    setTab(t);
    setMobileOpen(false);
  }

  const navItems: { key: Tab; label: string; Icon: React.ComponentType<{ active: boolean }> }[] = [
    { key: "log",       label: "Main Log",  Icon: LogIcon },
    { key: "tracker",   label: "Tracker",   Icon: TrackerIcon },
    { key: "dashboard", label: "Dashboard", Icon: DashboardIcon },
    ...(!isViewOnly ? [{ key: "settings" as Tab, label: "Settings", Icon: SettingsIcon }] : []),
    ...(isAdmin     ? [{ key: "teams"    as Tab, label: "Teams",    Icon: TeamsIcon    }] : []),
  ];

  const sideW = collapsed ? "w-16" : "w-56";

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex">

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col
        bg-[#1a2f5e] text-white
        transition-[width] duration-300 ease-in-out overflow-hidden
        ${sideW}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        transition-transform lg:transition-[width]
      `}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-3.5 py-4 border-b border-white/10 min-h-[64px]">
          <div className="w-9 h-9 rounded-xl bg-[#c9a84c] flex items-center justify-center flex-shrink-0 shadow">
            <span className="text-[#1a2f5e] font-black text-xs tracking-tight">AI</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-[#c9a84c] font-bold text-sm leading-tight whitespace-nowrap">AL-ITKAN</p>
              <p className="text-white/50 text-[10px] leading-tight whitespace-nowrap">Load Tracking System</p>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              title={collapsed ? label : undefined}
              className={`
                w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium
                transition-colors relative group
                ${collapsed ? "justify-center" : ""}
                ${tab === key
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90"
                }
              `}
            >
              {/* Active indicator */}
              {tab === key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[#c9a84c] rounded-r" />
              )}
              <Icon active={tab === key} />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/10 py-2 space-y-0.5">
          {/* Role badges (expanded only) */}
          {!collapsed && (isAdmin || isViewOnly) && (
            <div className="px-3.5 py-1.5 flex gap-1.5">
              {isAdmin    && <span className="text-[10px] bg-red-500   text-white px-2 py-0.5 rounded-full font-semibold">Admin</span>}
              {isViewOnly && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">View Only</span>}
            </div>
          )}

          <button
            onClick={() => setShowShare(true)}
            title={collapsed ? "Share" : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-white/55 hover:text-white/90 hover:bg-white/5 transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <ShareIcon />
            {!collapsed && <span>Share</span>}
          </button>

          <button
            onClick={() => setShowAdmin(true)}
            title={collapsed ? (isAdmin ? "Admin Panel" : "Admin Login") : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${isAdmin ? "text-[#c9a84c] hover:bg-white/5" : "text-white/55 hover:text-white/90 hover:bg-white/5"}`}
          >
            <AdminIcon isAdmin={isAdmin} />
            {!collapsed && <span>{isAdmin ? "Admin Panel" : "Admin Login"}</span>}
          </button>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand" : "Collapse"}
            className={`hidden lg:flex w-full items-center gap-3 px-3.5 py-2.5 text-sm text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <ChevronIcon left={!collapsed} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-in-out ${collapsed ? "lg:ml-16" : "lg:ml-56"}`}>

        {/* Mobile top bar */}
        <div className="lg:hidden bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30 flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#1a2f5e] p-1 -ml-1"
            aria-label="Open menu"
          >
            <HamburgerIcon />
          </button>
          <div className="flex-1">
            <p className="text-[#c9a84c] font-bold text-sm leading-tight">AL-ITKAN</p>
            <p className="text-gray-400 text-[10px] leading-tight">Engineers Load Tracking</p>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin    && <span className="text-[10px] bg-red-500   text-white px-2 py-0.5 rounded-full font-semibold">Admin</span>}
            {isViewOnly && <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-semibold">View Only</span>}
          </div>
        </div>

        {/* Tab content */}
        <main className="flex-1 pb-8">
          {tab === "log"       && <MainLog isViewOnly={isViewOnly} />}
          {tab === "tracker"   && <Tracker />}
          {tab === "dashboard" && <Dashboard isAdmin={isAdmin} />}
          {tab === "settings"  && !isViewOnly && <Settings />}
          {tab === "teams"     && isAdmin && <Teams />}
        </main>
      </div>

      {/* Modals */}
      {showAdmin && (
        <AdminModal
          isAdmin={isAdmin}
          onClose={() => setShowAdmin(false)}
          onAdminChange={(v) => { handleAdminChange(v); setShowAdmin(false); }}
        />
      )}
      {showShare && <ShareModal onClose={() => setShowShare(false)} />}
    </div>
  );
}
