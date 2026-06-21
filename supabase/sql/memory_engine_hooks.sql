-- =============================================================================
-- Memory engine hooks (schema only — passive data collection, no active logic)
-- Run after users.sql. Safe to run multiple times.
-- =============================================================================

-- Learned sender → category associations (future memory engine input)
create table if not exists public.sender_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  sender_email text,
  sender_domain text,
  category text not null,
  source text not null default 'correction',
  confidence numeric(4, 3) not null default 1.0,
  correction_count integer not null default 1,
  last_email_id text,
  account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sender_memory_user_sender_idx
  on public.sender_memory (user_id, sender_email, sender_domain);

-- Per-correction audit trail (AI guess vs user choice)
create table if not exists public.category_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  email_id text not null,
  account_id text,
  sender text,
  subject text,
  guessed_category text,
  chosen_category text not null,
  scope text not null default 'this_email',
  created_at timestamptz not null default now()
);

create index if not exists category_corrections_user_idx
  on public.category_corrections (user_id, created_at desc);

-- Log of manual overrides applied (distinct from email_overrides state table)
create table if not exists public.user_override_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  email_id text not null,
  account_id text,
  previous_category text,
  new_category text not null,
  scope text not null default 'this_email',
  created_at timestamptz not null default now()
);

create index if not exists user_override_log_user_idx
  on public.user_override_log (user_id, created_at desc);

notify pgrst, 'reload schema';
