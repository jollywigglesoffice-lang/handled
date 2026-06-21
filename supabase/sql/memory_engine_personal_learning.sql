-- =============================================================================
-- Memory Engine V1 — personal learning columns + behavior_signals
-- Run after memory_engine_hooks.sql and memory_engine_v1.sql. Idempotent.
-- =============================================================================

-- sender_memory: trust + preferred category + reply likelihood
alter table public.sender_memory
  add column if not exists trust_score numeric(4, 3),
  add column if not exists preferred_category text,
  add column if not exists reply_likelihood numeric(4, 3);

update public.sender_memory
set
  trust_score = coalesce(trust_score, confidence, 0.5),
  preferred_category = coalesce(preferred_category, category),
  reply_likelihood = coalesce(reply_likelihood, 0)
where trust_score is null or preferred_category is null or reply_likelihood is null;

-- category_corrections: explicit AI vs user columns + reason
alter table public.category_corrections
  add column if not exists ai_category text,
  add column if not exists user_category text,
  add column if not exists correction_reason text;

update public.category_corrections
set
  ai_category = coalesce(ai_category, guessed_category),
  user_category = coalesce(user_category, chosen_category)
where ai_category is null or user_category is null;

create index if not exists category_corrections_sender_idx
  on public.category_corrections (user_id, sender, created_at desc);

-- Every user interaction — actions, category moves, context
create table if not exists public.behavior_signals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  email_id text not null,
  account_id text,
  sender text,
  action_taken text not null,
  ai_category text,
  category_before text,
  category_after text,
  context text not null default 'inbox',
  created_at timestamptz not null default now()
);

create index if not exists behavior_signals_user_idx
  on public.behavior_signals (user_id, created_at desc);

create index if not exists behavior_signals_email_idx
  on public.behavior_signals (user_id, email_id, created_at desc);

notify pgrst, 'reload schema';
