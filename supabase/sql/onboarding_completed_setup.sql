-- Persist guided onboarding completion per user (source of truth for routing).
alter table public.users
  add column if not exists onboarding_completed boolean not null default false;

notify pgrst, 'reload schema';
