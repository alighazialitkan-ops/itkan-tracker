import { DAY_ABBRS } from "./constants";

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const datePart = String(dateStr).slice(0, 10);
  const d = new Date(datePart + "T00:00:00");
  if (isNaN(d.getTime())) return "—";
  return datePart;
}

export function formatDateWithDay(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const datePart = String(dateStr).slice(0, 10);
  const date = new Date(datePart + "T00:00:00");
  if (isNaN(date.getTime())) return "—";
  const day = DAY_ABBRS[date.getDay()];
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${day}, ${d}/${m}/${y}`;
}

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function getFrequentEngineers(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem("engineerFrequency");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function recordEngineerUsage(engineers: string[]): void {
  if (typeof window === "undefined") return;
  const freq = getFrequentEngineers();
  for (const eng of engineers) {
    freq[eng] = (freq[eng] || 0) + 1;
  }
  localStorage.setItem("engineerFrequency", JSON.stringify(freq));
}

export function getTopFrequentEngineers(limit = 10): string[] {
  const freq = getFrequentEngineers();
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export function seedFrequencyFromEntries(engineers: string[][]): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("engineerFrequencySeeded")) return;
  const freq: Record<string, number> = {};
  for (const row of engineers) {
    for (const eng of row) {
      freq[eng] = (freq[eng] || 0) + 1;
    }
  }
  localStorage.setItem("engineerFrequency", JSON.stringify(freq));
  localStorage.setItem("engineerFrequencySeeded", "1");
}
