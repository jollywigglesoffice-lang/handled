import { resolveSenderIdentity } from "@/lib/sender-identity";

const STORAGE_KEY = "handled_sender_email_opens_v1";

type SenderOpenCounts = Record<string, number>;

function senderKey(sender: string): string {
  return resolveSenderIdentity(sender).ruleKey.slice(0, 120);
}

function readCounts(): SenderOpenCounts {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SenderOpenCounts = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && value > 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeCounts(counts: SenderOpenCounts): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    /* quota */
  }
}

/** Record that the user opened an email from this sender. */
export function recordSenderEmailOpen(sender: string): void {
  const key = senderKey(sender);
  if (!key) return;
  const counts = readCounts();
  counts[key] = (counts[key] ?? 0) + 1;
  writeCounts(counts);
}

export function getSenderEmailOpenCount(sender: string): number {
  const key = senderKey(sender);
  if (!key) return 0;
  return readCounts()[key] ?? 0;
}
