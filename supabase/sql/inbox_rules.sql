-- Personalized inbox triage rules (per Auth user).
-- Category CHECK values must match lib/inbox-ai-categories.ts (INBOX_AI_CATEGORY_VALUES).
-- Run in Supabase SQL editor after `users` exists.

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
        'fyi',
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

-- RLS: users manage only their rows (enable when using anon client from browser).
-- alter table public.inbox_rules enable row level security;
-- create policy "inbox_rules_own" on public.inbox_rules
--   for all using (auth.uid()::text = user_id);
