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
