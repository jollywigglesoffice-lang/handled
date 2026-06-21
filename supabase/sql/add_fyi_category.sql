-- Adds the "good_to_know" (Good to know) inbox category to inbox_rules.category CHECK.
-- Canonical slug list: lib/inbox-ai-categories.ts → INBOX_AI_CATEGORY_VALUES
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.inbox_rules
  drop constraint if exists inbox_rules_category_check;

alter table public.inbox_rules
  add constraint inbox_rules_category_check
  check (
    category is null
    or category in (
      'worth_your_attention',
      'worth_your_attention',
      'good_to_know',
      'newsletters',
      'promotions',
      'good_to_know'
    )
  );

notify pgrst, 'reload schema';
