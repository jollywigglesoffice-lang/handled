-- =============================================================================
-- Sender learning rules — per-sender categorization (run after users.sql)
-- =============================================================================

create table if not exists public.users (
  id text primary key,
  email text,
  is_pro boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.sender_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  sender_email text not null default '',
  sender_domain text not null default '',
  target_category text not null,
  label text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sender_rules_user_id_idx on public.sender_rules (user_id);

create unique index if not exists sender_rules_user_email_idx
  on public.sender_rules (user_id, lower(sender_email))
  where sender_email <> '';

create unique index if not exists sender_rules_user_domain_idx
  on public.sender_rules (user_id, lower(sender_domain))
  where sender_email = '' and sender_domain <> '';

notify pgrst, 'reload schema';
