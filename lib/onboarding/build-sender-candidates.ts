import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export type SenderCandidate = {
  sender: string;
  sampleSubject: string;
  count: number;
  dominantCategory: InboxAiCategory;
};

const PROMO_CATEGORIES = new Set<InboxAiCategory>(["promotions", "newsletters"]);
const HUMAN_CATEGORIES = new Set<InboxAiCategory>(["worth_your_attention", "good_to_know"]);

function aggregateBySender(messages: GmailCardMessage[]): Map<string, SenderCandidate> {
  const map = new Map<
    string,
    { sender: string; count: number; sampleSubject: string; categories: InboxAiCategory[] }
  >();

  for (const message of messages) {
    const key = resolveSenderIdentity(message.sender).ruleKey || message.sender;
    const bucket = map.get(key) ?? {
      sender: message.sender,
      count: 0,
      sampleSubject: message.subject || message.snippet || "",
      categories: [],
    };
    bucket.count += 1;
    bucket.categories.push(message.category);
    if (!bucket.sampleSubject && message.subject) {
      bucket.sampleSubject = message.subject;
    }
    map.set(key, bucket);
  }

  const out = new Map<string, SenderCandidate>();
  for (const [key, bucket] of map) {
    const counts = new Map<InboxAiCategory, number>();
    for (const cat of bucket.categories) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    let dominantCategory: InboxAiCategory = bucket.categories[0] ?? "worth_your_attention";
    let top = 0;
    for (const [cat, n] of counts) {
      if (n > top) {
        top = n;
        dominantCategory = cat;
      }
    }
    out.set(key, {
      sender: bucket.sender,
      sampleSubject: bucket.sampleSubject,
      count: bucket.count,
      dominantCategory,
    });
  }
  return out;
}

export function buildOnboardingSenderCandidates(messages: GmailCardMessage[]): {
  importantCandidates: SenderCandidate[];
  promotionalCandidates: SenderCandidate[];
} {
  const bySender = aggregateBySender(messages);
  const all = [...bySender.values()];

  const importantCandidates = all
    .filter(
      (c) =>
        HUMAN_CATEGORIES.has(c.dominantCategory) ||
        c.dominantCategory === "worth_your_attention",
    )
    .sort((a, b) => {
      const score = (c: SenderCandidate) =>
        (c.dominantCategory === "worth_your_attention" ? 3 : 0) + Math.min(c.count, 5);
      return score(b) - score(a);
    })
    .slice(0, 12);

  const promotionalCandidates = all
    .filter((c) => PROMO_CATEGORIES.has(c.dominantCategory))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  if (promotionalCandidates.length < 6) {
    const seen = new Set(promotionalCandidates.map((c) => c.sender));
    for (const c of all) {
      if (promotionalCandidates.length >= 12) break;
      if (seen.has(c.sender)) continue;
      if (importantCandidates.some((i) => i.sender === c.sender)) continue;
      promotionalCandidates.push(c);
      seen.add(c.sender);
    }
  }

  return { importantCandidates, promotionalCandidates };
}
