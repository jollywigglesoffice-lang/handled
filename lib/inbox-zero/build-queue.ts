import type { CategoryTab } from "@/app/emails/category-tabs";
import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxBuckets } from "@/lib/inbox-buckets";

/** Build focus queue from current category tab — respects active filters, never hides mail from categories. */
export function buildInboxZeroQueue(
  activeCategoryTab: CategoryTab,
  gmailBuckets: InboxBuckets<GmailCardMessage>,
  filterList: (list: GmailCardMessage[]) => GmailCardMessage[],
  isCompleted: (id: string) => boolean,
): GmailCardMessage[] {
  let raw: GmailCardMessage[] = [];

  if (activeCategoryTab === "all") {
    for (const category of gmailBuckets.categoryOrder) {
      raw.push(...((gmailBuckets.byCategory[category] ?? []) as GmailCardMessage[]));
    }
    if (gmailBuckets.showClutterSection) {
      raw.push(...(gmailBuckets.clutterEmails as GmailCardMessage[]));
    }
  } else {
    raw = (gmailBuckets.byCategoryAll[activeCategoryTab] ?? []) as GmailCardMessage[];
  }

  const seen = new Set<string>();
  const deduped: GmailCardMessage[] = [];
  for (const message of filterList(raw)) {
    if (seen.has(message.id) || isCompleted(message.id)) continue;
    seen.add(message.id);
    deduped.push(message);
  }

  return deduped;
}
