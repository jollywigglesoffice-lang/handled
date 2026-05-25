import { senderDisplayName } from "@/lib/situational-understanding";
import type { InboxAiCategory } from "@/lib/inbox-ai-categories";

export type ClutterMessage = {
  id: string;
  sender: string;
  subject: string;
  snippet?: string;
  category: InboxAiCategory;
};

export type ClutterBatch = {
  id: string;
  label: string;
  reassurance: string;
  messages: ClutterMessage[];
};

const STORE_HAY =
  /\b(order|shipped|delivery|tracking|receipt|your purchase|amazon|apple|google play|shopify|etsy|ebay|fedex|ups|dhl|spedizione|ordine|consegna)\b/i;

function hay(m: ClutterMessage): string {
  return `${m.sender} ${m.subject} ${m.snippet ?? ""}`;
}

function isStoreNotification(m: ClutterMessage): boolean {
  return STORE_HAY.test(hay(m));
}

function batchLabel(
  count: number,
  kind: "newsletter" | "promotion" | "store",
  locale: "en" | "it",
  name?: string,
): string {
  if (kind === "newsletter") {
    return locale === "it"
      ? count === 1
        ? "1 newsletter raggruppata"
        : `${count} newsletter raggruppate`
      : count === 1
        ? "1 newsletter grouped"
        : `${count} newsletters grouped together`;
  }
  if (kind === "store") {
    return locale === "it"
      ? `${count} notifiche negozio — probabilmente nessuna azione`
      : `${count} store notifications — no action likely needed`;
  }
  if (name && count >= 2) {
    return locale === "it"
      ? `${count} da ${name}`
      : `${count} from ${name}`;
  }
  return locale === "it"
    ? count === 1
      ? "1 promozione"
      : `${count} promozioni raggruppate`
    : count === 1
      ? "1 promotion"
      : `${count} promotions grouped`;
}

function reassurance(locale: "en" | "it"): string {
  return locale === "it"
    ? "Niente di urgente qui — puoi aprirle quando vuoi."
    : "Nothing time-sensitive here — open when you want.";
}

/**
 * Group newsletters, store pings, and repetitive promotions to cut visual noise.
 */
export function buildClutterBatches(
  messages: ClutterMessage[],
  locale: "en" | "it" = "en",
): ClutterBatch[] {
  if (!messages.length) return [];

  const newsletters = messages.filter((m) => m.category === "newsletter");
  const promotions = messages.filter((m) => m.category === "promotion");
  const batches: ClutterBatch[] = [];
  const calm = reassurance(locale);

  if (newsletters.length > 0) {
    batches.push({
      id: "batch-newsletters",
      label: batchLabel(newsletters.length, "newsletter", locale),
      reassurance: calm,
      messages: newsletters,
    });
  }

  const storeMsgs = promotions.filter(isStoreNotification);
  const otherPromos = promotions.filter((m) => !isStoreNotification(m));

  if (storeMsgs.length >= 2) {
    batches.push({
      id: "batch-store",
      label: batchLabel(storeMsgs.length, "store", locale),
      reassurance: calm,
      messages: storeMsgs,
    });
  } else {
    otherPromos.push(...storeMsgs);
  }

  const bySender = new Map<string, ClutterMessage[]>();
  for (const m of otherPromos) {
    const key = senderDisplayName(m.sender).toLowerCase();
    const list = bySender.get(key) ?? [];
    list.push(m);
    bySender.set(key, list);
  }

  const singles: ClutterMessage[] = [];
  for (const [key, list] of bySender) {
    if (list.length >= 3) {
      batches.push({
        id: `batch-promo-${key}`,
        label: batchLabel(list.length, "promotion", locale, senderDisplayName(list[0]!.sender)),
        reassurance: calm,
        messages: list,
      });
    } else {
      singles.push(...list);
    }
  }

  if (singles.length >= 2) {
    batches.push({
      id: "batch-promo-misc",
      label: batchLabel(singles.length, "promotion", locale),
      reassurance: calm,
      messages: singles,
    });
  } else if (singles.length === 1) {
    batches.push({
      id: `batch-promo-${singles[0]!.id}`,
      label: batchLabel(1, "promotion", locale, senderDisplayName(singles[0]!.sender)),
      reassurance: calm,
      messages: singles,
    });
  }

  return batches;
}
