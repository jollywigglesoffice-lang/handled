-- Run in Supabase SQL editor (Dashboard → SQL → New query)
create table if not exists users (
  id text primary key,
  email text,
  is_pro boolean default false,
  created_at timestamptz default now()
);

-- If the table already exists without `email`, run:
-- alter table users add column if not exists email text;

-- App sync: Auth user id = users.id; email is set on login and via service-role sync.
-- See supabase/snippets/users-stripe-customer.sql for stripe_* columns.
