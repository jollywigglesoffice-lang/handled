-- Human trust-layer feedback — edge cases, categorization misses, UX confusion.
-- Run after users.sql. Safe to run multiple times.

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.users (id) on delete set null,
  category text not null check (
    category in (
      'bug',
      'wrong_category',
      'missing_email',
      'ux_confusion',
      'other'
    )
  ),
  message text not null,
  screen_context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_user_idx
  on public.product_feedback (user_id, created_at desc);

create index if not exists product_feedback_category_idx
  on public.product_feedback (category, created_at desc);

notify pgrst, 'reload schema';
