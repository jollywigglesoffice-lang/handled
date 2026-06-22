import type { ConnectedGmailAccount } from "@/lib/gmail/account-types";
import {
  gmailGetInboxLabelStats,
  gmailGetMessagesMetadata,
  gmailListInboxPage,
  type GmailInboxLabelStats,
  type GmailInboxRow,
} from "@/lib/gmail-api";
import { getFreshGoogleAccessToken, withGoogleAuthRetry } from "@/lib/google/google-access-token";

export type UnifiedInboxFetchResult = {
  rows: GmailInboxRow[];
  gmailTruth: GmailInboxLabelStats | null;
  accountsLoaded: number;
};

/**
 * Fetch inbox messages from one or all connected accounts, merge by date.
 * V1: no cross-account pagination token — each account fetches one page.
 */
export async function fetchUnifiedInboxPage(input: {
  userId: string;
  accounts: ConnectedGmailAccount[];
  accountFilterId?: string | null;
  maxResults: number;
  pageToken?: string | null;
  /** Gmail search query — defaults to `in:inbox`. */
  query?: string;
}): Promise<UnifiedInboxFetchResult> {
  const targets = input.accountFilterId
    ? input.accounts.filter((a) => a.id === input.accountFilterId)
    : input.accounts;

  if (targets.length === 0) {
    return { rows: [], gmailTruth: null, accountsLoaded: 0 };
  }

  const perAccountMax = Math.max(
    20,
    Math.ceil(input.maxResults / targets.length),
  );

  const fetches = await Promise.all(
    targets.map(async (account) => {
      const token = await getFreshGoogleAccessToken(input.userId, {
        accountId: account.id,
      });
      if (!token) return { account, rows: [] as GmailInboxRow[], truth: null };

      try {
        const [listPage, truth] = await Promise.all([
          withGoogleAuthRetry(
            input.userId,
            token,
            (t) =>
              gmailListInboxPage(t, {
                maxResults: perAccountMax,
                pageToken: input.pageToken ?? undefined,
                query: input.query,
              }),
            { accountId: account.id },
          ),
          withGoogleAuthRetry(
            input.userId,
            token,
            (t) => gmailGetInboxLabelStats(t),
            { accountId: account.id },
          ).catch(() => null),
        ]);

        const rows = await withGoogleAuthRetry(
          input.userId,
          token,
          (t) => gmailGetMessagesMetadata(t, listPage.items.map((m) => m.id), 25),
          { accountId: account.id },
        );

        const stamped = rows.map((row) => ({
          ...row,
          accountId: account.id,
          accountEmail: account.email,
          accountLabel: account.label,
        }));

        return { account, rows: stamped, truth };
      } catch (err) {
        console.warn(
          `[fetch-unified-inbox] account ${account.email} failed`,
          err,
        );
        return { account, rows: [] as GmailInboxRow[], truth: null };
      }
    }),
  );

  const merged = fetches
    .flatMap((f) => f.rows)
    .sort((a, b) => b.internalDateMs - a.internalDateMs)
    .slice(0, input.maxResults);

  const truths = fetches.map((f) => f.truth).filter(Boolean) as GmailInboxLabelStats[];
  const gmailTruth =
    truths.length > 0
      ? {
          inboxTotal: truths.reduce((s, t) => s + t.inboxTotal, 0),
          unreadTotal: truths.reduce((s, t) => s + t.unreadTotal, 0),
        }
      : null;

  return {
    rows: merged,
    gmailTruth,
    accountsLoaded: fetches.filter((f) => f.rows.length > 0).length,
  };
}

/** Merge inbox rows by account-scoped id, newest first. */
export function mergeUnifiedInboxRows(
  primary: GmailInboxRow[],
  extra: GmailInboxRow[],
  maxResults: number,
): GmailInboxRow[] {
  const seen = new Set<string>();
  const merged: GmailInboxRow[] = [];
  for (const row of [...primary, ...extra]) {
    const key = row.accountId ? `${row.accountId}:${row.id}` : row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged
    .sort((a, b) => b.internalDateMs - a.internalDateMs)
    .slice(0, maxResults);
}

/** Search messages across connected accounts (Gmail q syntax — subject, sender, body). */
export async function fetchUnifiedGmailSearch(input: {
  userId: string;
  accounts: ConnectedGmailAccount[];
  accountFilterId?: string | null;
  gmailQuery: string;
  maxResults: number;
}): Promise<UnifiedInboxFetchResult> {
  const targets = input.accountFilterId
    ? input.accounts.filter((a) => a.id === input.accountFilterId)
    : input.accounts;

  if (targets.length === 0) {
    return { rows: [], gmailTruth: null, accountsLoaded: 0 };
  }

  const perAccountMax = Math.max(10, Math.ceil(input.maxResults / targets.length));

  const fetches = await Promise.all(
    targets.map(async (account) => {
      const token = await getFreshGoogleAccessToken(input.userId, {
        accountId: account.id,
      });
      if (!token) return { rows: [] as GmailInboxRow[] };

      try {
        const listPage = await withGoogleAuthRetry(
          input.userId,
          token,
          (t) =>
            gmailListInboxPage(t, {
              maxResults: perAccountMax,
              query: input.gmailQuery,
            }),
          { accountId: account.id },
        );

        const rows = await withGoogleAuthRetry(
          input.userId,
          token,
          (t) => gmailGetMessagesMetadata(t, listPage.items.map((m) => m.id), 20),
          { accountId: account.id },
        );

        return {
          rows: rows.map((row) => ({
            ...row,
            accountId: account.id,
            accountEmail: account.email,
            accountLabel: account.label,
          })),
        };
      } catch (err) {
        console.warn(`[fetch-unified-search] account ${account.email} failed`, err);
        return { rows: [] as GmailInboxRow[] };
      }
    }),
  );

  const merged = fetches
    .flatMap((f) => f.rows)
    .sort((a, b) => b.internalDateMs - a.internalDateMs)
    .slice(0, input.maxResults);

  return {
    rows: merged,
    gmailTruth: null,
    accountsLoaded: fetches.filter((f) => f.rows.length > 0).length,
  };
}
