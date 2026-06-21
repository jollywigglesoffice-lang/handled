-- =============================================================================
-- Memory Engine V1 — personal email behavior model
-- Run after memory_engine_hooks.sql. Safe to run multiple times.
-- =============================================================================

-- Action patterns: how user responds to senders (reply, ignore, defer)
create table if not exists public.action_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  sender_email text,
  sender_domain text,
  action_id text not null,
  category text,
  sample_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists action_memory_user_sender_action_idx
  on public.action_memory (
    user_id,
    coalesce(sender_email, ''),
    coalesce(sender_domain, ''),
    action_id
  );

-- Category patterns: repeated moves for sender domain + topic keyword
create table if not exists public.category_pattern_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  sender_domain text not null,
  subject_keyword text not null,
  category text not null,
  correction_count integer not null default 1,
  confidence numeric(4, 3) not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists category_pattern_memory_user_pattern_idx
  on public.category_pattern_memory (user_id, sender_domain, subject_keyword);

-- Upsert support for sender_memory
create unique index if not exists sender_memory_user_sender_unique_idx
  on public.sender_memory (
    user_id,
    coalesce(sender_email, ''),
    coalesce(sender_domain, '')
  );

notify pgrst, 'reload schema';
