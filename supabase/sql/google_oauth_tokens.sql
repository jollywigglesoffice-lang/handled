-- =============================================================================
-- Google OAuth token storage (run after users.sql)
--
-- Stores the long-lived Google provider_refresh_token plus a short-lived
-- cached access token so server-side Gmail calls can mint a fresh access token
-- on demand instead of replaying an expired one from the client.
--
-- Tokens are written by the service role only (see lib/google/google-token-store.ts)
-- and are encrypted at rest with AES-256-GCM when TOKEN_ENCRYPTION_KEY is set
-- (see lib/crypto/token-cipher.ts). Values may be plaintext in local dev when no
-- key is configured.
-- =============================================================================

alter table public.users
  add column if not exists google_refresh_token text;

alter table public.users
  add column if not exists google_access_token text;

alter table public.users
  add column if not exists google_token_expires_at timestamptz;

notify pgrst, 'reload schema';
