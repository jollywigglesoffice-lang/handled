-- =============================================================================
-- Connected Gmail accounts (multi-account V1)
-- One Handled user may connect multiple Gmail mailboxes.
-- Tokens are encrypted at rest via lib/crypto/token-cipher.ts (service role).
-- =============================================================================

create table if not exists public.connected_gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  email text not null,
  label text,
  is_primary boolean not null default false,
  google_refresh_token text,
  google_access_token text,
  google_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connected_gmail_accounts_user_email_unique unique (user_id, email)
);

create index if not exists connected_gmail_accounts_user_id_idx
  on public.connected_gmail_accounts (user_id);

notify pgrst, 'reload schema';
