-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- One row per user holding their synced app state. Row Level Security means the
-- public anon key can only ever touch the signed-in user's own row.

create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated    jsonb not null default '{}'::jsonb,   -- per-key last-modified timestamps (ms)
  version    integer not null default 1,           -- optimistic concurrency counter
  updated_at timestamptz not null default now(),
  constraint user_state_size check (pg_column_size(data) < 1000000)
);

alter table public.user_state enable row level security;

create policy "read own state"   on public.user_state for select using (auth.uid() = user_id);
create policy "insert own state" on public.user_state for insert with check (auth.uid() = user_id);
create policy "update own state" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own state" on public.user_state for delete using (auth.uid() = user_id);
