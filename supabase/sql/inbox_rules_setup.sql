-- =============================================================================
-- Inbox Priority Rules — run this entire file in Supabase SQL Editor
-- Dashboard → SQL → New query → Paste → Run
-- =============================================================================

-- 1) Ensure users table exists (app already uses this)
create table if not exists public.users (
  id text primary key,
  email text,
  is_pro boolean default false,
  created_at timestamptz default now()
);

-- 2) Fallback JSON column (works even if inbox_rules table is missing)
alter table public.users
  add column if not exists inbox_rules_json jsonb not null default '[]'::jsonb;

-- 3) Dedicated rules table (preferred storage)
create table if not exists public.inbox_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  enabled boolean not null default true,
  priority integer not null default 100,
  phase text not null default 'pre'
    check (phase in ('pre', 'post')),
  action_type text not null
    check (action_type in ('force_category', 'block', 'demote', 'boost')),
  category text
    check (
      category is null
      or category in (
        'needs_attention',
        'quick_reply',
        'newsletter',
        'promotion',
        'handled'
      )
    ),
  match_type text not null
    check (
      match_type in (
        'sender_email',
        'sender_domain',
        'sender_contains',
        'subject_contains',
        'keywords_contains'
      )
    ),
  match_value text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_rules_user_enabled_idx
  on public.inbox_rules (user_id, enabled, phase, priority desc);

-- 4) Service role bypasses RLS; optional policies if you use anon client later
alter table public.inbox_rules enable row level security;

drop policy if exists "inbox_rules_service_all" on public.inbox_rules;
create policy "inbox_rules_service_all" on public.inbox_rules
  for all
  using (true)
  with check (true);

-- Reload PostgREST schema cache (fixes "table not in schema cache")
notify pgrst, 'reload schema';
