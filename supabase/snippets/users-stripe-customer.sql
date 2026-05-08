-- Run in Supabase SQL editor (or migrations) so billing portal + checkout can persist Stripe customer id.
alter table public.users
add column if not exists stripe_customer_id text;

alter table public.users
add column if not exists stripe_subscription_id text;
