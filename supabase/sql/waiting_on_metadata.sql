-- Waiting On workflow metadata (separate from email_completions_json).
-- Foundation for reminders, calendar integration, recurring follow-ups.
-- Run in Supabase SQL editor when server sync is enabled.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS waiting_on_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;
