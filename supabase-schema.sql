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
