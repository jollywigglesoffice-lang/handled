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
    scanning: "I'm checking your inbox…",
    conversations: "Just looking at a few recent conversations…",
    senders: "Getting a feel for who you hear from…",
    finding: "Looking for a good place to start…",
    widening: "I'm widening the search a little…",
    lookingBroader: "Checking newsletters, replies, and social updates…",
    expandingSearch: "Just scanning a few more messages…",
    resultReady: "Found something you might want to look at.",
  },
  it: {
    scanning: "Sto controllando la tua inbox…",
    conversations: "Do un'occhiata alle conversazioni recenti…",
    senders: "Mi faccio un'idea di chi senti di più…",
    finding: "Cerco un buon punto di partenza…",
    widening: "Amplio un po' la ricerca…",
    lookingBroader: "Controllo newsletter, risposte e aggiornamenti social…",
    expandingSearch: "Scansiono ancora qualche messaggio…",
    resultReady: "Ho trovato qualcosa che potrebbe interessarti.",
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
