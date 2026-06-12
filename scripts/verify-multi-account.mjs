/**
 * One-off verification: replicate the unified inbox fetch per connected account
 * and report account count, per-account message counts, and cross-account
 * duplicate message ids. Run: node scripts/verify-multi-account.mjs
 */
import { readFileSync } from "fs";
import crypto from "node:crypto";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

function decryptSecret(stored) {
  if (!stored) return null;
  if (!stored.startsWith("gcm1.")) return stored;
  const raw = env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  const [, ivB64, tagB64, ctB64] = stored.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function freshAccessToken(account) {
  const access = decryptSecret(account.google_access_token);
  const expiresAt = account.google_token_expires_at
    ? new Date(account.google_token_expires_at).getTime()
    : 0;
  if (access && expiresAt - Date.now() > 5 * 60 * 1000) return access;

  const refresh = decryptSecret(account.google_refresh_token);
  if (!refresh) return access;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) {
    console.error(`  token refresh failed for ${account.email}:`, res.status, await res.text());
    return access;
  }
  return (await res.json()).access_token;
}

const accountsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/connected_gmail_accounts?select=*&order=connected_at.asc`,
  { headers: sbHeaders },
);
const accounts = await accountsRes.json();

console.log(`\n=== connected_gmail_accounts: ${accounts.length} row(s) ===`);
for (const a of accounts) {
  console.log(
    `  ${a.email} | label="${a.label}" | primary=${a.is_primary} | user=${a.user_id.slice(0, 8)} | refresh=${Boolean(a.google_refresh_token)} | access=${Boolean(a.google_access_token)}`,
  );
}

const perAccountIds = new Map();
for (const account of accounts) {
  const token = await freshAccessToken(account);
  if (!token) {
    console.log(`\n${account.email}: NO USABLE TOKEN`);
    continue;
  }

  const profileRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const profile = await profileRes.json();

  const labelRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const label = await labelRes.json();

  // Same call as gmailListInboxPage with the initial page size (200).
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=in:inbox",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const list = await listRes.json();
  const ids = (list.messages ?? []).map((m) => m.id);
  perAccountIds.set(account.email, ids);

  console.log(`\n=== ${account.email} ===`);
  console.log(`  mailbox (users/me/profile): ${profile.emailAddress ?? "ERROR " + JSON.stringify(profile).slice(0, 120)}`);
  console.log(`  Gmail inbox total: ${label.messagesTotal ?? "?"} | unread: ${label.messagesUnread ?? "?"}`);
  console.log(`  fetched this page (maxResults=200): ${ids.length} message(s)`);
  console.log(`  resultSizeEstimate: ${list.resultSizeEstimate ?? "?"}`);
}

const emails = [...perAccountIds.keys()];
let dupes = 0;
for (let i = 0; i < emails.length; i++) {
  for (let j = i + 1; j < emails.length; j++) {
    const setB = new Set(perAccountIds.get(emails[j]));
    const overlap = perAccountIds.get(emails[i]).filter((id) => setB.has(id));
    if (overlap.length) {
      dupes += overlap.length;
      console.log(`\nDUPLICATE IDS between ${emails[i]} and ${emails[j]}: ${overlap.length}`);
    }
  }
}
console.log(`\n=== cross-account duplicate message ids: ${dupes} ===`);
