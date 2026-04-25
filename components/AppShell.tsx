"use client";
import { useState, useEffect } from "react";
import Header from "./Header";
import Navigation from "./Navigation";
import MainLog from "./MainLog";
import Tracker from "./Tracker";
import Dashboard from "./Dashboard";
import Settings from "./Settings";
import Teams from "./Teams";

type Tab = "log" | "tracker" | "dashboard" | "settings" | "teams";

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("log");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  useEffect(() => {
    // Check session and URL params
    const adminSession = sessionStorage.getItem("isAdmin");
    if (adminSession) setIsAdmin(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "view") setIsViewOnly(true);
  }, []);

  function handleAdminChange(v: boolean) {
    setIsAdmin(v);
    if (!v && tab === "teams") setTab("log");
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      <Header isAdmin={isAdmin} isViewOnly={isViewOnly} onAdminChange={handleAdminChange} />
      <Navigation
        activeTab={tab}
        onChange={setTab}
        isAdmin={isAdmin}
        isViewOnly={isViewOnly}
      />
      <main className="pb-8">
        {tab === "log" && <MainLog isViewOnly={isViewOnly} />}
        {tab === "tracker" && <Tracker />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "settings" && !isViewOnly && <Settings />}
        {tab === "teams" && isAdmin && <Teams />}
      </main>
    </div>
  );
}
