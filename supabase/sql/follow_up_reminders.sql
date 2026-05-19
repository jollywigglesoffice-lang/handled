-- =============================================================================
-- Follow-up reminders & conversation memory (run after users.sql)
-- =============================================================================

create table if not exists public.follow_up_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  email_id text not null,
  thread_id text,
  conversation_state text not null,
  urgency_score int not null default 50,
  reminder_title text not null,
  reminder_body text not null,
  status text not null default 'active',
  snoozed_until timestamptz,
  analysis_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists follow_up_reminders_user_email_idx
  on public.follow_up_reminders (user_id, email_id);

create index if not exists follow_up_reminders_user_status_idx
  on public.follow_up_reminders (user_id, status);

notify pgrst, 'reload schema';
