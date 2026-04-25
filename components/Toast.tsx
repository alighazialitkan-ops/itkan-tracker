"use client";
import { useEffect } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-[#1a2f5e]",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-[9999] ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in`}
      style={{ animation: "slideInUp 0.3s ease" }}
    >
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}
