-- Adds the new "fyi" inbox category (important, no reply needed — e.g. shipping
-- and order confirmations) to the inbox_rules category CHECK constraint.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.inbox_rules
  drop constraint if exists inbox_rules_category_check;

alter table public.inbox_rules
  add constraint inbox_rules_category_check
  check (
    category is null
    or category in (
      'needs_attention',
      'quick_reply',
      'fyi',
      'newsletter',
      'promotion',
      'handled'
    )
  );

notify pgrst, 'reload schema';
