-- =============================================================================
-- Handled Brain — per-entry cloud storage (run after users.sql)
-- =============================================================================

create table if not exists public.users (
  id text primary key,
  email text,
  is_pro boolean default false,
  created_at timestamptz default now()
);

alter table public.users
  add column if not exists handled_brain_writing_style text;

create table if not exists public.handled_brain_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  category text not null default 'faq',
  title text not null default '',
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists handled_brain_entries_user_id_idx
  on public.handled_brain_entries (user_id);

create index if not exists handled_brain_entries_user_updated_idx
  on public.handled_brain_entries (user_id, updated_at desc);

-- Optional: migrate legacy JSON blob into rows (run once per user on first load in app)

notify pgrst, 'reload schema';
