-- =============================================================================
-- Per-sender relationship intelligence (run after users.sql)
-- =============================================================================

create table if not exists public.sender_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  sender_email text not null default '',
  sender_domain text not null default '',
  relationship_kind text not null default 'unknown',
  importance text not null default 'normal',
  display_label text,
  source text not null default 'manual',
  confidence real not null default 1,
  enabled boolean not null default true,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sender_relationships_user_id_idx
  on public.sender_relationships (user_id);

create unique index if not exists sender_relationships_user_email_idx
  on public.sender_relationships (user_id, lower(sender_email))
  where sender_email <> '';

create unique index if not exists sender_relationships_user_domain_idx
  on public.sender_relationships (user_id, lower(sender_domain))
  where sender_email = '' and sender_domain <> '';

notify pgrst, 'reload schema';
