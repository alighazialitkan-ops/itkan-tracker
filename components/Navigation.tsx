"use client";

type Tab = "log" | "tracker" | "dashboard" | "settings" | "teams";

type NavigationProps = {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  isAdmin: boolean;
  isViewOnly: boolean;
};

export default function Navigation({ activeTab, onChange, isAdmin, isViewOnly }: NavigationProps) {
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "log", label: "Main Log", icon: "📋" },
    { key: "tracker", label: "Tracker", icon: "📊" },
    { key: "dashboard", label: "Dashboard", icon: "📈" },
    ...(!isViewOnly ? [{ key: "settings" as Tab, label: "Settings", icon: "⚙️" }] : []),
    ...(isAdmin ? [{ key: "teams" as Tab, label: "Teams", icon: "👥" }] : []),
  ];

  return (
    <nav className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#c9a84c] text-[#1a2f5e] bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-[#1a2f5e] hover:bg-blue-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
