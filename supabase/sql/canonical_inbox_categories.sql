-- Canonical inbox categories — single source of truth for DB CHECK + stored values.

update public.inbox_rules set category = 'worth_your_attention' where category in (
  'needs_attention', 'need_attention', 'attention', 'quick_reply', 'focus', 'quick_wins'
);

update public.inbox_rules set category = 'good_to_know' where category in (
  'fyi', 'handled', 'can_wait', 'passive', 'background', 'informational'
);

update public.inbox_rules set category = 'promotions' where category in ('promotion', 'promotional', 'marketing');

update public.inbox_rules set category = 'newsletters' where category in ('newsletter', 'digest');

update public.inbox_rules set category = 'worth_your_attention' where category in (
  'waiting', 'waiting_on', 'waiting_on_reply', 'waiting_for_response'
);

update public.inbox_rules set category = 'good_to_know' where category in ('complete', 'completed', 'archived', 'done');

alter table public.inbox_rules drop constraint if exists inbox_rules_category_check;

alter table public.inbox_rules add constraint inbox_rules_category_check check (
  category is null
  or category in (
    'worth_your_attention',
    'good_to_know',
    'promotions',
    'newsletters'
  )
  or category like 'custom:%'
);
