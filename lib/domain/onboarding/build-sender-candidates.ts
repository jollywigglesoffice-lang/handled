import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";
import { resolveSenderIdentity } from "@/lib/sender-identity";

export type SenderCandidate = {
  sender: string;
  sampleSubject: string;
  count: number;
  dominantCategory: InboxAiCategory;
};

export type SenderClusterMode =
  | "people"
  | "newsletters"
  | "services"
  | "transactional"
  | "promotions";

export const SENDER_CLUSTER_ROTATION: SenderClusterMode[] = [
  "people",
  "services",
  "newsletters",
  "transactional",
  "promotions",
];

export const CLUSTER_LABELS: Record<SenderClusterMode, { en: string; it: string }> = {
  people: { en: "People & conversations", it: "Persone e conversazioni" },
  services: { en: "Services & tools", it: "Servizi e strumenti" },
  newsletters: { en: "Newsletters", it: "Newsletter" },
  transactional: { en: "Receipts & updates", it: "Ricevute e aggiornamenti" },
  promotions: { en: "Promotions & marketing", it: "Promozioni e marketing" },
};

const PROMO_CATEGORIES = new Set<InboxAiCategory>(["promotions", "newsletters"]);
const HUMAN_CATEGORIES = new Set<InboxAiCategory>(["worth_your_attention", "good_to_know"]);

const SERVICE_SENDER =
  /\b(noreply|no-reply|notifications?|mailer|support|hello@|team@|news@|info@|updates@)\b/i;
const TRANSACTIONAL_SUBJECT =
  /\b(receipt|invoice|order|shipment|tracking|payment|statement|confirmation|password|verify|security alert)\b/i;
const PERSONAL_DOMAIN =
  /@(gmail\.com|icloud\.com|outlook\.com|yahoo\.com|hotmail\.com|proton\.me|live\.com)$/i;

const PAGE_SIZE = 8;

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
  for (const [, bucket] of map) {
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
    out.set(bucket.sender, {
      sender: bucket.sender,
      sampleSubject: bucket.sampleSubject,
      count: bucket.count,
      dominantCategory,
    });
  }
  return out;
}

function matchesCluster(candidate: SenderCandidate, cluster: SenderClusterMode): boolean {
  const hay = `${candidate.sender} ${candidate.sampleSubject}`.toLowerCase();

  switch (cluster) {
    case "people":
      return (
        HUMAN_CATEGORIES.has(candidate.dominantCategory) ||
        PERSONAL_DOMAIN.test(candidate.sender) ||
        (!SERVICE_SENDER.test(candidate.sender) &&
          !PROMO_CATEGORIES.has(candidate.dominantCategory) &&
          candidate.dominantCategory === "worth_your_attention")
      );
    case "newsletters":
      return candidate.dominantCategory === "newsletters" || /\b(newsletter|digest|weekly)\b/i.test(hay);
    case "services":
      return SERVICE_SENDER.test(candidate.sender) || /\b(notifications?|alert|account)\b/i.test(hay);
    case "transactional":
      return (
        candidate.dominantCategory === "good_to_know" ||
        TRANSACTIONAL_SUBJECT.test(hay) ||
        /\b(receipt|invoice|order)\b/i.test(hay)
      );
    case "promotions":
      return candidate.dominantCategory === "promotions" || /\b(sale|offer|%\s*off|promo)\b/i.test(hay);
    default:
      return true;
  }
}

function scoreCandidate(candidate: SenderCandidate, cluster: SenderClusterMode): number {
  let score = Math.min(candidate.count, 8);
  if (cluster === "people" && candidate.dominantCategory === "worth_your_attention") score += 4;
  if (cluster === "promotions" && candidate.dominantCategory === "promotions") score += 3;
  if (cluster === "newsletters" && candidate.dominantCategory === "newsletters") score += 3;
  if (cluster === "transactional" && TRANSACTIONAL_SUBJECT.test(candidate.sampleSubject)) score += 3;
  if (cluster === "services" && SERVICE_SENDER.test(candidate.sender)) score += 3;
  return score;
}

function paginateCluster(
  pool: SenderCandidate[],
  refreshIndex: number,
): { items: SenderCandidate[]; cluster: SenderClusterMode; page: number } {
  const clusterCount = SENDER_CLUSTER_ROTATION.length;
  const cluster = SENDER_CLUSTER_ROTATION[refreshIndex % clusterCount]!;
  const page = Math.floor(refreshIndex / clusterCount);

  const ranked = pool
    .filter((c) => matchesCluster(c, cluster))
    .sort((a, b) => scoreCandidate(b, cluster) - scoreCandidate(a, cluster));

  let items = ranked.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (items.length === 0 && ranked.length > 0) {
    items = ranked.slice(0, PAGE_SIZE);
  }

  if (items.length === 0) {
    const fallback = [...pool].sort((a, b) => b.count - a.count);
    items = fallback.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (items.length === 0 && fallback.length > 0) {
      items = fallback.slice(0, PAGE_SIZE);
    }
  }

  return { items, cluster, page };
}

export function buildOnboardingSenderCandidates(
  messages: GmailCardMessage[],
  options?: { refreshIndex?: number },
): {
  importantCandidates: SenderCandidate[];
  promotionalCandidates: SenderCandidate[];
  cluster: SenderClusterMode;
  clusterLabel: { en: string; it: string };
} {
  const refreshIndex = options?.refreshIndex ?? 0;
  const bySender = aggregateBySender(messages);
  const all = [...bySender.values()];

  const { items: primaryPool, cluster } = paginateCluster(all, refreshIndex);

  const importantCandidates = primaryPool.filter(
    (c) => !PROMO_CATEGORIES.has(c.dominantCategory) || cluster === "people",
  );

  const promotionalCandidates =
    cluster === "promotions" || cluster === "newsletters"
      ? primaryPool
      : all
          .filter((c) => PROMO_CATEGORIES.has(c.dominantCategory))
          .sort((a, b) => b.count - a.count)
          .slice(0, PAGE_SIZE);

  const important =
    importantCandidates.length > 0
      ? importantCandidates
      : primaryPool.length > 0
        ? primaryPool
        : all.sort((a, b) => b.count - a.count).slice(0, PAGE_SIZE);

  const promo =
    promotionalCandidates.length > 0
      ? promotionalCandidates.slice(0, PAGE_SIZE)
      : all
          .filter((c) => PROMO_CATEGORIES.has(c.dominantCategory))
          .sort((a, b) => b.count - a.count)
          .slice(0, PAGE_SIZE);

  return {
    importantCandidates: important,
    promotionalCandidates: promo,
    cluster,
    clusterLabel: CLUSTER_LABELS[cluster],
  };
}
