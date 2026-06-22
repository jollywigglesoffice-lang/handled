import type { GmailCardMessage } from "@/app/emails/gmail-inbox-card";
import { getSenderEmailOpenCount } from "@/lib/importance-memory/sender-opens";
import {
  isConversationExample,
  isSocialNotificationExample,
  MIN_ONBOARDING_EXAMPLES,
  onboardingExampleBucket,
} from "@/lib/onboarding/example-buckets";
import { resolveSenderIdentity } from "@/lib/sender-identity";
import { voiceOnboardingFallback } from "@/lib/voice";

export type EmotionalContextId =
  | "similar_before"
  | "usually_respond"
  | "sender_quiet"
  | "informational_calm"
  | "open_when_time"
  | "conversation_thread"
  | "newsletter_pace"
  | "promo_no_pressure"
  | "social_glance"
  | "worth_attention_soft"
  | "good_to_know_soft";

export type MicroReassuranceId = "learn_as_you_go" | "no_perfect" | "gets_better";

const EMOTIONAL_CONTEXT: Record<
  "en" | "it",
  Record<EmotionalContextId, string>
> = {
  en: {
    similar_before: "You've interacted with similar messages before.",
    usually_respond: "This looks like something you usually respond to.",
    sender_quiet: "You haven't heard from this sender in a while.",
    informational_calm: "This is informational — useful, and fine to read when you have time.",
    open_when_time: "You often open emails like this when you have time.",
    conversation_thread: "Part of an ongoing conversation — handle it when you're ready.",
    newsletter_pace: "Worth a look when you have time — no rush.",
    promo_no_pressure: "Good to know — browse when it suits you.",
    social_glance: "A quick glance is usually enough for messages like this.",
    worth_attention_soft: "Worth your attention when you're ready.",
    good_to_know_soft: "Good to know — you might find this useful later.",
  },
  it: {
    similar_before: "Hai già interagito con messaggi simili.",
    usually_respond: "Sembra qualcosa a cui rispondi di solito.",
    sender_quiet: "Non senti questo mittente da un po'.",
    informational_calm: "È informativo — utile, da leggere quando hai tempo.",
    open_when_time: "Spesso apri email così quando hai un momento.",
    conversation_thread: "Parte di una conversazione — gestiscila quando vuoi.",
    newsletter_pace: "Da dare un'occhiata quando hai tempo — senza fretta.",
    promo_no_pressure: "Buono a sapersi — guardalo quando ti fa comodo.",
    social_glance: "Di solito basta una rapida occhiata per messaggi così.",
    worth_attention_soft: "Merita attenzione quando sei pronto.",
    good_to_know_soft: "Buono a sapersi — potrebbe esserti utile più tardi.",
  },
};

export const MICRO_REASSURANCE: Record<
  "en" | "it",
  Record<MicroReassuranceId, string>
> = {
  en: {
    learn_as_you_go: "We'll learn what matters to you as you go.",
    no_perfect: "No need to get this perfect — we adjust automatically.",
    gets_better: "Handled gets better the more you use it.",
  },
  it: {
    learn_as_you_go: "Impareremo cosa conta per te strada facendo.",
    no_perfect: "Non serve azzeccare tutto — ci adattiamo da soli.",
    gets_better: "Handled migliora più lo usi.",
  },
};

export const EMOTIONAL_FALLBACK: Record<
  "en" | "it",
  { title: string; body: string }
> = {
  en: voiceOnboardingFallback("en"),
  it: voiceOnboardingFallback("it"),
};

const MICRO_REASSURANCE_ORDER: MicroReassuranceId[] = [
  "learn_as_you_go",
  "no_perfect",
  "gets_better",
];

const QUIET_SENDER_DAYS = 10;

function messageAgeDays(date: string): number | null {
  const ms = Date.parse(date);
  if (!Number.isFinite(ms)) return null;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24);
}

function countSimilarInPool(
  message: GmailCardMessage,
  pool: GmailCardMessage[],
): number {
  const identity = resolveSenderIdentity(message.sender);
  const domain = identity.domain;
  return pool.filter((m) => {
    if (m.id === message.id) return false;
    if (m.category === message.category) return true;
    if (domain && resolveSenderIdentity(m.sender).domain === domain) return true;
    return false;
  }).length;
}

function senderIsQuiet(message: GmailCardMessage, pool: GmailCardMessage[]): boolean {
  const age = messageAgeDays(message.date);
  if (age === null || age < QUIET_SENDER_DAYS) return false;

  const identity = resolveSenderIdentity(message.sender);
  const key = identity.ruleKey;
  const recentFromSender = pool.some((m) => {
    if (m.id === message.id) return false;
    if (resolveSenderIdentity(m.sender).ruleKey !== key) return false;
    const otherAge = messageAgeDays(m.date);
    return otherAge !== null && otherAge < QUIET_SENDER_DAYS;
  });

  return !recentFromSender;
}

export function resolveOnboardingEmotionalContext(
  message: GmailCardMessage,
  locale: "en" | "it",
  options?: { pool?: GmailCardMessage[] },
): string {
  const pool = options?.pool ?? [];
  const lines = EMOTIONAL_CONTEXT[locale];
  const bucket = onboardingExampleBucket(message);
  const openCount = getSenderEmailOpenCount(message.sender);
  const similarCount = countSimilarInPool(message, pool);

  if (similarCount >= 2) return lines.similar_before;
  if (isConversationExample(message)) return lines.conversation_thread;
  if (senderIsQuiet(message, pool)) return lines.sender_quiet;
  if (openCount >= 2) return lines.open_when_time;
  if (openCount >= 1 && message.category === "worth_your_attention") {
    return lines.usually_respond;
  }

  if (isSocialNotificationExample(message)) return lines.social_glance;

  switch (message.category) {
    case "good_to_know":
      return lines.informational_calm;
    case "newsletters":
      return lines.newsletter_pace;
    case "promotions":
      return lines.promo_no_pressure;
    case "worth_your_attention":
      if (bucket === "conversation") return lines.conversation_thread;
      return lines.worth_attention_soft;
    default:
      return lines.good_to_know_soft;
  }
}

export function pickMicroReassurance(
  locale: "en" | "it",
  seed: number,
): string {
  const id = MICRO_REASSURANCE_ORDER[Math.abs(seed) % MICRO_REASSURANCE_ORDER.length]!;
  return MICRO_REASSURANCE[locale][id];
}

export function shouldShowMicroReassurance(exampleCount: number, isProcessing: boolean): boolean {
  return exampleCount < MIN_ONBOARDING_EXAMPLES || isProcessing;
}
