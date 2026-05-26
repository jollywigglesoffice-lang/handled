-- =============================================================================
-- Per-email manual category overrides (run after users.sql)
-- =============================================================================

create table if not exists public.email_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  email_id text not null,
  original_category text,
  overridden_category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_overrides_user_email_idx
  on public.email_overrides (user_id, email_id);

create index if not exists email_overrides_user_id_idx
  on public.email_overrides (user_id);

-- Fallback when dedicated table is unavailable (mirrors sender_preferences_json)
alter table public.users
  add column if not exists email_overrides_json jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
