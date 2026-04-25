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
