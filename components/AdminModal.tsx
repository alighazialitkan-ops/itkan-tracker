"use client";
import { useState, useEffect } from "react";
import { hashString } from "@/lib/utils";

type AdminModalProps = {
  isAdmin: boolean;
  onClose: () => void;
  onAdminChange: (v: boolean) => void;
};

type View = "loading" | "setup" | "login" | "forgot" | "reset" | "loggedIn";

export default function AdminModal({ isAdmin, onClose, onAdminChange }: AdminModalProps) {
  const [view, setView] = useState<View>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) { setView("loggedIn"); return; }
    fetch("/api/admin/setup")
      .then((r) => r.json())
      .then((d) => setView(d.configured ? "login" : "setup"));
  }, [isAdmin]);

  async function handleSetup() {
    setError("");
    if (password.length < 4) return setError("Password must be at least 4 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (pin.length < 4) return setError("PIN must be 4-6 digits");
    if (pin !== confirmPin) return setError("PINs do not match");
    setLoading(true);
    const password_hash = await hashString(password);
    const pin_hash = await hashString(pin);
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password_hash, pin_hash }),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json(); return setError(d.error); }
    sessionStorage.setItem("isAdmin", "1");
    onAdminChange(true);
  }

  async function handleLogin() {
    setError("");
    setLoading(true);
    const password_hash = await hashString(password);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password_hash }),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json(); return setError(d.error); }
    sessionStorage.setItem("isAdmin", "1");
    onAdminChange(true);
  }

  async function handleVerifyPin() {
    setError("");
    setLoading(true);
    const pin_hash = await hashString(pin);
    const r = await fetch("/api/admin/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin_hash }),
    });
    setLoading(false);
    if (!r.ok) { const d = await r.json(); return setError(d.error); }
    setView("reset");
    setPin("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleReset() {
    setError("");
    if (password.length < 4) return setError("Password must be at least 4 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setLoading(true);
    const password_hash = await hashString(password);
    await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password_hash }),
    });
    setLoading(false);
    setView("login");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  function handleLogout() {
    sessionStorage.removeItem("isAdmin");
    onAdminChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-[#1a2f5e] text-lg">
            {view === "setup" && "Create Admin Account"}
            {view === "login" && "Admin Login"}
            {view === "forgot" && "Forgot Password"}
            {view === "reset" && "Reset Password"}
            {view === "loggedIn" && "Admin Panel"}
            {view === "loading" && "Loading..."}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

          {view === "loading" && <div className="text-center py-4 text-gray-500">Checking configuration…</div>}

          {view === "setup" && (
            <>
              <div>
                <label className="label">Password (min 4 chars)</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
              </div>
              <div>
                <label className="label">PIN (4-6 digits, for password reset)</label>
                <input type="password" inputMode="numeric" className="input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g. 1234" maxLength={6} />
              </div>
              <div>
                <label className="label">Confirm PIN</label>
                <input type="password" inputMode="numeric" className="input" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="Confirm PIN" maxLength={6} />
              </div>
              <button onClick={handleSetup} disabled={loading} className="btn-primary w-full mt-2">
                {loading ? "Setting up…" : "Create Account"}
              </button>
            </>
          )}

          {view === "login" && (
            <>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              </div>
              <button onClick={handleLogin} disabled={loading} className="btn-primary w-full">
                {loading ? "Verifying…" : "Login"}
              </button>
              <button onClick={() => { setView("forgot"); setError(""); setPassword(""); }} className="text-sm text-[#1a2f5e] underline w-full text-center mt-1">
                Forgot password?
              </button>
            </>
          )}

          {view === "forgot" && (
            <>
              <p className="text-sm text-gray-600">Enter your PIN to reset your password.</p>
              <div>
                <label className="label">PIN</label>
                <input type="password" inputMode="numeric" className="input" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" maxLength={6} onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()} />
              </div>
              <button onClick={handleVerifyPin} disabled={loading} className="btn-primary w-full">
                {loading ? "Verifying…" : "Verify PIN"}
              </button>
              <button onClick={() => { setView("login"); setError(""); setPin(""); }} className="text-sm text-gray-500 underline w-full text-center">
                Back to login
              </button>
            </>
          )}

          {view === "reset" && (
            <>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
              </div>
              <button onClick={handleReset} disabled={loading} className="btn-primary w-full">
                {loading ? "Resetting…" : "Reset Password"}
              </button>
            </>
          )}

          {view === "loggedIn" && (
            <>
              <p className="text-sm text-gray-600">You are logged in as Admin.</p>
              <button onClick={handleLogout} className="btn-danger w-full">Logout</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
