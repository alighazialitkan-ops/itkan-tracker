-- Engineers Load Tracking System — AL-ITKAN
-- Run this in Supabase SQL Editor

create table if not exists entries (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  city       text not null,
  engineers  text[] not null,
  km         integer default 0,
  weight     integer default 1,
  created_at timestamp default now()
);

create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  members    text[],
  created_at timestamp default now()
);

create table if not exists exclusions (
  id             uuid primary key default gen_random_uuid(),
  engineer_name  text unique not null,
  excluded       boolean default true,
  note           text,
  updated_at     timestamp default now()
);

create table if not exists admin_config (
  id            uuid primary key default gen_random_uuid(),
  password_hash text not null,
  pin_hash      text not null,
  created_at    timestamp default now()
);

-- Enable Row Level Security (adjust policies for your use case)
alter table entries       enable row level security;
alter table teams         enable row level security;
alter table exclusions    enable row level security;
alter table admin_config  enable row level security;

-- Allow all operations via anon key (simplest setup — tighten for production)
create policy "allow all entries"       on entries       for all using (true) with check (true);
create policy "allow all teams"         on teams         for all using (true) with check (true);
create policy "allow all exclusions"    on exclusions    for all using (true) with check (true);
create policy "allow all admin_config"  on admin_config  for all using (true) with check (true);

-- Enable Realtime for entries
alter publication supabase_realtime add table entries;

-- ── Order Tracking Module ─────────────────────────────────────────────────────

create table if not exists assets (
  id         uuid primary key default gen_random_uuid(),
  serial     text unique not null,
  site       text not null,
  created_at timestamp default now()
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  order_no         text unique not null,
  order_date       date not null,
  case_no          text,
  serial           text,
  site             text,
  part_description text,
  status           text not null default 'Requested',
  remarks          text,
  created_at       timestamp default now(),
  updated_at       timestamp default now()
);

create table if not exists order_awbs (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  awb_number text not null,
  created_at timestamp default now()
);

create table if not exists activity_log (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     text,
  username   text,
  created_at timestamp default now()
);

alter table assets       enable row level security;
alter table orders       enable row level security;
alter table order_awbs   enable row level security;
alter table activity_log enable row level security;

create policy "allow all assets"       on assets       for all using (true) with check (true);
create policy "allow all orders"       on orders       for all using (true) with check (true);
create policy "allow all order_awbs"   on order_awbs   for all using (true) with check (true);
create policy "allow all activity_log" on activity_log for all using (true) with check (true);

-- Add city and customer to assets (safe to run multiple times)
alter table assets add column if not exists city     text;
alter table assets add column if not exists customer text;

-- ── Daily Log Parent-Child Tables (v2) ────────────────────────────────────────

create table if not exists daily_logs (
  id             uuid primary key default gen_random_uuid(),
  date           date unique not null,
  total_km       integer default 0,
  total_weight   numeric(4,1) default 0,
  engineer_count integer default 0,
  created_by     text,
  created_at     timestamp default now(),
  updated_at     timestamp default now()
);

create table if not exists daily_log_details (
  id           uuid primary key default gen_random_uuid(),
  daily_log_id uuid references daily_logs(id) on delete cascade,
  city         text not null,
  engineers    text[] not null,
  km           integer default 0,
  weight       numeric(4,1) default 0,
  start_date   date,
  end_date     date,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);

alter table daily_logs        enable row level security;
alter table daily_log_details enable row level security;

create policy "allow all daily_logs"        on daily_logs        for all using (true) with check (true);
create policy "allow all daily_log_details" on daily_log_details for all using (true) with check (true);

-- ── One-time migration from entries → daily_logs + daily_log_details ──────────
-- Safe to run multiple times: the DO block checks if details are already present.

do $$
begin
  if not exists (select 1 from daily_log_details limit 1) then

    -- Parent rows: one per distinct date
    insert into daily_logs (date, created_at)
    select distinct date, min(created_at)
    from entries
    group by date
    on conflict (date) do nothing;

    -- Child rows: one per existing entry
    insert into daily_log_details (daily_log_id, city, engineers, km, weight, start_date, end_date, created_at)
    select dl.id, e.city, e.engineers, e.km,
      round(e.weight::numeric * 2) / 2,
      e.date, e.date, e.created_at
    from entries e
    join daily_logs dl on dl.date = e.date;

    -- Recalculate parent km + weight totals
    update daily_logs dl set
      total_km     = sub.total_km,
      total_weight = sub.avg_weight
    from (
      select daily_log_id,
        sum(km)                    as total_km,
        round(avg(weight) * 2) / 2 as avg_weight
      from daily_log_details
      group by daily_log_id
    ) sub
    where dl.id = sub.daily_log_id;

    -- Recalculate parent engineer counts
    update daily_logs dl set
      engineer_count = sub.cnt
    from (
      select daily_log_id, count(distinct eng) as cnt
      from daily_log_details, lateral unnest(engineers) eng
      group by daily_log_id
    ) sub
    where dl.id = sub.daily_log_id;

  end if;
end $$;

-- ── Fix: deduplicate daily_logs (one row per date) ────────────────────────────
-- Run this if you see duplicate parent date rows in the Main Log.
-- Safe to run multiple times: no-op when no duplicates exist.

do $dedup$
begin
  -- Ensure UNIQUE constraint exists (may be missing on older installs)
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_logs_date_key'
      and conrelid = 'daily_logs'::regclass
  ) then
    alter table daily_logs add constraint daily_logs_date_key unique (date);
  end if;

  if exists (select 1 from daily_logs group by date having count(*) > 1) then
    -- Reassign children from duplicate parents to canonical (earliest) parent
    update daily_log_details
    set daily_log_id = canon.id
    from (
      select distinct on (date) id, date
      from daily_logs
      order by date, created_at asc
    ) canon
    join daily_logs dup on dup.date = canon.date and dup.id <> canon.id
    where daily_log_details.daily_log_id = dup.id;

    -- Delete the now-empty duplicate parents
    delete from daily_logs
    using (
      select distinct on (date) id as cid, date
      from daily_logs
      order by date, created_at asc
    ) canon
    where daily_logs.date = canon.date
      and daily_logs.id   <> canon.cid;

    -- Recalculate totals on surviving parents
    update daily_logs dl set
      total_km       = agg.km,
      total_weight   = agg.wt,
      engineer_count = agg.eng_cnt,
      updated_at     = now()
    from (
      select
        dld.daily_log_id,
        coalesce(sum(dld.km), 0)                    as km,
        round(coalesce(avg(dld.weight), 0) * 2) / 2 as wt,
        count(distinct eng)                          as eng_cnt
      from daily_log_details dld,
           lateral unnest(dld.engineers) eng
      group by dld.daily_log_id
    ) agg
    where dl.id = agg.daily_log_id;
  end if;
end $dedup$;
