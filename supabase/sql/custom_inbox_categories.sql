-- Personal inbox categories (per user). System categories stay in code
-- (lib/inbox-ai-categories.ts → SYSTEM_INBOX_CATEGORY_VALUES).

alter table public.users
  add column if not exists custom_categories_json jsonb not null default '[]'::jsonb;

-- Allow inbox_rules to reference personal categories (custom:slug).
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
    or category like 'custom:%'
  );

notify pgrst, 'reload schema';
