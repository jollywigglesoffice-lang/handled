export type LiveProcessingLineId =
  | "scanning"
  | "conversations"
  | "senders"
  | "finding"
  | "widening"
  | "lookingBroader"
  | "expandingSearch"
  | "resultReady";

export const LIVE_PROCESSING_LINES: Record<
  "en" | "it",
  Record<LiveProcessingLineId, string>
> = {
  en: {
    scanning: "Scanning your inbox…",
    conversations: "Analyzing recent conversations…",
    senders: "Learning who you hear from…",
    finding: "Finding a calm starting point for you…",
    widening: "We're widening the search…",
    lookingBroader: "Looking at newsletters, replies, and social updates…",
    expandingSearch: "Expanding search across your inbox…",
    resultReady: "When you're ready — here's one to try",
  },
  it: {
    scanning: "Scansione della inbox…",
    conversations: "Analisi delle conversazioni recenti…",
    senders: "Riconoscimento dei mittenti abituali…",
    finding: "Scelta di un punto di partenza tranquillo…",
    widening: "Ampliamento della ricerca…",
    lookingBroader: "Esame di newsletter, risposte e aggiornamenti social…",
    expandingSearch: "Ricerca estesa nella inbox…",
    resultReady: "Quando vuoi — ecco una email con cui iniziare",
  },
};

/** Base intelligence sequence shown on every Step 3 entry. */
export const BASE_PROCESSING_SEQUENCE: LiveProcessingLineId[] = [
  "scanning",
  "conversations",
  "senders",
  "finding",
];

/** Extra narrative when example pool is thin. */
export const WIDENING_PROCESSING_SEQUENCE: LiveProcessingLineId[] = [
  "widening",
  "lookingBroader",
];

export const FALLBACK_PROCESSING_SEQUENCE: LiveProcessingLineId[] = ["expandingSearch"];
