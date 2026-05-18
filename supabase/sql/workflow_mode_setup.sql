-- Persist workflow mode per user (Assist / Clean / Handle)
alter table public.users
  add column if not exists workflow_mode text default 'assist';

notify pgrst, 'reload schema';
