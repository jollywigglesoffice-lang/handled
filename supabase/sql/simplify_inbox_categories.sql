-- Simplify inbox category system to five canonical slugs.
-- Run after deploying app code that maps legacy categories on read.

-- Migrate stored rules / overrides (best-effort; app also coerces on read).
update public.inbox_rules
set category = 'worth_your_attention'
where category in ('worth_your_attention', 'focus', 'quick_wins');

update public.inbox_rules
set category = 'good_to_know'
where category in ('good_to_know', 'can_wait', 'passive', 'background');

update public.inbox_rules
set category = 'waiting_on'
where category in ('waiting_on_reply', 'waiting');

-- Extend CHECK constraint — adjust table name if your deployment differs.
alter table public.inbox_rules drop constraint if exists inbox_rules_category_check;

alter table public.inbox_rules add constraint inbox_rules_category_check check (
  category is null
  or category in (
    'worth_your_attention',
    'good_to_know',
    'waiting_on',
    'promotions',
    'newsletters'
  )
  or category like 'custom:%'
);
