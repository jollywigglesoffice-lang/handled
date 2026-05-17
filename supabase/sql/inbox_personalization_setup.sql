-- =============================================================================
-- Handled personalization — run in Supabase SQL Editor after users.sql
-- Adds JSON columns for rules + sender learning (works without inbox_rules table)
-- =============================================================================

create table if not exists public.users (
  id text primary key,
  email text,
  is_pro boolean default false,
  created_at timestamptz default now()
);

alter table public.users
  add column if not exists inbox_rules_json jsonb not null default '[]'::jsonb;

alter table public.users
  add column if not exists sender_preferences_json jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
