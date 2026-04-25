"use client";
import { useEffect, useState } from "react";
import { TEAMS } from "@/lib/constants";
import type { Team } from "@/lib/supabase";
import EngineerSearch from "./EngineerSearch";
import Toast from "./Toast";

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [engInput, setEngInput] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTeams(); }, []);

  async function loadTeams() {
    setLoading(true);
    const r = await fetch("/api/teams");
    const data: Team[] = await r.json();
    setTeams(data);
    if (selectedTeam) {
      const updated = data.find((t) => t.id === selectedTeam.id);
      setSelectedTeam(updated || null);
    }
    setLoading(false);
  }

  async function createTeam() {
    if (!newName.trim()) return;
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), members: [] }),
    });
    setNewName("");
    setShowNewModal(false);
    setToast({ msg: "Team created", type: "success" });
    loadTeams();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete this team?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (selectedTeam?.id === id) setSelectedTeam(null);
    setToast({ msg: "Team deleted", type: "success" });
    loadTeams();
  }

  async function renameTeam(id: string) {
    if (!renameTo.trim()) return;
    await fetch(`/api/teams/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameTo.trim() }),
    });
    setRenaming(null);
    setRenameTo("");
    setToast({ msg: "Team renamed", type: "success" });
    loadTeams();
  }

  async function addMember(teamId: string, name: string) {
    if (!name) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team || team.members.includes(name)) return;
    await fetch(`/api/teams/${teamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: [...team.members, name] }),
    });
    setEngInput("");
    setToast({ msg: "Member added", type: "success" });
    loadTeams();
  }

  async function removeMember(teamId: string, name: string) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    await fetch(`/api/teams/${teamId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members: team.members.filter((m) => m !== name) }),
    });
    setToast({ msg: "Member removed", type: "success" });
    loadTeams();
  }

  async function seedDefaultTeams() {
    for (const name of TEAMS) {
      if (!teams.find((t) => t.name === name)) {
        await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, members: [] }),
        });
      }
    }
    loadTeams();
    setToast({ msg: "Default teams seeded", type: "success" });
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left — Teams list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#1a2f5e]">Teams</h2>
            <div className="flex gap-2">
              {teams.length === 0 && (
                <button onClick={seedDefaultTeams} className="btn-outline text-xs px-3 py-1.5">
                  Seed Default Teams
                </button>
              )}
              <button onClick={() => setShowNewModal(true)} className="btn-primary text-sm">
                + New Team
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-x-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading…</div>
            ) : teams.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <div className="text-4xl mb-2">👥</div>
                <div>No teams yet. Create one or seed the defaults.</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f0f4ff] border-b border-blue-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Members</th>
                    <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {teams.map((team) => (
                    <tr key={team.id} className={`hover:bg-blue-50/30 transition-colors ${selectedTeam?.id === team.id ? "bg-blue-50" : ""}`}>
                      <td className="px-4 py-3 font-semibold text-[#1a2f5e]">
                        {renaming === team.id ? (
                          <div className="flex gap-1">
                            <input className="input text-sm py-1 w-28" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && renameTeam(team.id)} autoFocus />
                            <button onClick={() => renameTeam(team.id)} className="btn-primary text-xs px-2 py-1">Save</button>
                            <button onClick={() => setRenaming(null)} className="text-gray-400 hover:text-gray-600 px-1">×</button>
                          </div>
                        ) : team.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-[#1a2f5e]/10 text-[#1a2f5e] text-xs font-semibold px-2 py-0.5 rounded-full">
                          {team.members.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setSelectedTeam(team)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Manage</button>
                          <button onClick={() => { setRenaming(team.id); setRenameTo(team.name); }} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Rename</button>
                          <button onClick={() => deleteTeam(team.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right — Team members */}
        <div className="space-y-3">
          {selectedTeam ? (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1a2f5e]">
                  {selectedTeam.name} — Members
                </h2>
                <span className="bg-[#1a2f5e]/10 text-[#1a2f5e] text-xs font-semibold px-2 py-0.5 rounded-full">
                  {selectedTeam.members.length}
                </span>
              </div>

              <div className="card space-y-2">
                <label className="label">Add Engineer</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <EngineerSearch
                      value={engInput}
                      onChange={(v) => setEngInput(v)}
                      exclude={selectedTeam.members}
                      placeholder="Search and select engineer…"
                    />
                  </div>
                  <button
                    onClick={() => { addMember(selectedTeam.id, engInput); }}
                    disabled={!engInput}
                    className="btn-primary text-sm shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="card p-0">
                {selectedTeam.members.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">No members yet.</div>
                ) : (
                  <div className="divide-y divide-blue-50">
                    {selectedTeam.members.map((name) => (
                      <div key={name} className="flex items-center justify-between px-4 py-2.5 hover:bg-blue-50/30">
                        <span className="text-sm font-medium text-[#1a2f5e]">{name}</span>
                        <button
                          onClick={() => removeMember(selectedTeam.id, name)}
                          className="text-red-400 hover:text-red-600 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-2">👈</div>
                <div>Select a team to manage its members</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Team Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-[#1a2f5e]">New Team</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Team Name</label>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. CT" autoFocus onKeyDown={(e) => e.key === "Enter" && createTeam()} />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowNewModal(false)} className="btn-outline">Cancel</button>
                <button onClick={createTeam} className="btn-primary">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
