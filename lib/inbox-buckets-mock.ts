import type { FakeEmail, InboxSectionTitle } from "@/lib/fake-emails";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import type { InboxBucketMessage } from "@/lib/inbox-buckets";

export type MockInboxMessage = InboxBucketMessage & {
  sender: string;
  subject: string;
  snippet: string;
};

function sectionToCategory(section: InboxSectionTitle): InboxAiCategory {
  if (section === "Needs Your Attention") return "needs_attention";
  if (section === "Handled For You") return "handled";
  return "newsletter";
}

export function fakeEmailsToInboxMessages(
  emails: FakeEmail[],
  handledEmailIds: string[],
): MockInboxMessage[] {
  return emails
    .filter((e) => !handledEmailIds.includes(e.id))
    .map((e) => ({
      id: e.id,
      category: sectionToCategory(e.section),
      sender: e.sender,
      subject: e.subject,
      snippet: e.summary,
    }));
}
