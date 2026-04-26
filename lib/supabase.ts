import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env vars not set. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local");
    _client = createClient(url, key);
  }
  return _client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getSupabase() as any)[prop];
  },
});

export type Entry = {
  id: string;
  date: string;
  city: string;
  engineers: string[];
  km: number;
  weight: number;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  members: string[];
  created_at: string;
};

export type Exclusion = {
  id: string;
  engineer_name: string;
  excluded: boolean;
  note: string;
  updated_at: string;
};

export type Order = {
  id: string;
  order_no: string;
  order_date: string;
  case_no: string;
  serial: string;
  site: string;
  part_description: string;
  status: string;
  remarks: string;
  awbs: string[];
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  serial: string;
  site: string;
  city: string;
  customer: string;
  created_at: string;
};

export type DailyLogDetail = {
  id: string;
  daily_log_id: string;
  city: string;
  engineers: string[];
  km: number;
  weight: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
};

export type DailyLog = {
  id: string;
  date: string;
  total_km: number;
  total_weight: number;
  engineer_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  details: DailyLogDetail[];
};
