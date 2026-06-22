import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import {
  MAX_ONBOARDING_EXAMPLES,
  MIN_ONBOARDING_EXAMPLES,
  ONBOARDING_BUCKET_ROTATION,
  onboardingExampleBucket,
} from "@/lib/onboarding/example-buckets";

export { MIN_ONBOARDING_EXAMPLES, MAX_ONBOARDING_EXAMPLES } from "@/lib/onboarding/example-buckets";

/** Pick a diverse guided queue — one pass per bucket, then fill by recency. */
export function buildFirstTimeOnboardingQueue(
  messages: GmailCardMessage[],
  isCompleted: (id: string) => boolean,
  options?: { refreshIndex?: number },
): GmailCardMessage[] {
  const candidates = messages.filter((m) => !isCompleted(m.id));
  if (candidates.length === 0) return [];

  const refreshIndex = options?.refreshIndex ?? 0;
  const rotationOffset = refreshIndex % ONBOARDING_BUCKET_ROTATION.length;
  const rotatedBuckets = [
    ...ONBOARDING_BUCKET_ROTATION.slice(rotationOffset),
    ...ONBOARDING_BUCKET_ROTATION.slice(0, rotationOffset),
  ];

  const buckets = new Map<string, GmailCardMessage[]>();
  for (const message of candidates) {
    const bucket = onboardingExampleBucket(message);
    const list = buckets.get(bucket) ?? [];
    list.push(message);
    buckets.set(bucket, list);
  }

  for (const list of buckets.values()) {
    list.sort((a, b) => b.date.localeCompare(a.date));
  }

  const seen = new Set<string>();
  const picked: GmailCardMessage[] = [];

  let progressed = true;
  while (picked.length < MAX_ONBOARDING_EXAMPLES && progressed) {
    progressed = false;
    for (const bucket of rotatedBuckets) {
      const pool = buckets.get(bucket) ?? [];
      const next = pool.find((m) => !seen.has(m.id));
      if (!next) continue;
      seen.add(next.id);
      picked.push(next);
      progressed = true;
      if (picked.length >= MAX_ONBOARDING_EXAMPLES) break;
    }
  }

  const otherPool = buckets.get("other") ?? [];
  for (const message of [...otherPool, ...candidates]) {
    if (picked.length >= MAX_ONBOARDING_EXAMPLES) break;
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    picked.push(message);
  }

  return picked.slice(0, MAX_ONBOARDING_EXAMPLES);
}

export function needsMoreOnboardingExamples(
  queue: GmailCardMessage[],
  totalCandidates: number,
): boolean {
  return queue.length < MIN_ONBOARDING_EXAMPLES && totalCandidates > queue.length;
}
