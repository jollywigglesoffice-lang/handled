-- Email completion workflow (READ ≠ DONE) + custom completion actions + learning signals.
-- Run in Supabase SQL editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_completion_actions_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_completions_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS completion_learning_json jsonb NOT NULL DEFAULT '{"version":1,"patterns":[]}'::jsonb;
