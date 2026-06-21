import type { TimeImpactResult, TimeStripBand } from "@/lib/time-impact/types";

export type TimeStripItem = {
  id: string;
  sender: string;
  subject: string;
  kind: TimeImpactResult["kind"];
  timeBand: TimeStripBand;
  deadlineHint?: string;
  accountId?: string;
};

export type TimeStripGroup = {
  band: TimeStripBand;
  label: string;
  items: TimeStripItem[];
};

const BAND_ORDER: TimeStripBand[] = ["today", "tomorrow", "this_week"];

const BAND_LABELS = {
  en: {
    today: "Today",
    tomorrow: "Tomorrow",
    this_week: "This week",
    later: "Later",
  },
  it: {
    today: "Oggi",
    tomorrow: "Domani",
    this_week: "Questa settimana",
    later: "Più avanti",
  },
} as const;

export type TimeStripMessage = {
  id: string;
  sender: string;
  subject: string;
  timeImpact?: TimeImpactResult;
  accountId?: string;
};

export function buildTimeStripGroups(
  messages: TimeStripMessage[],
  locale: "en" | "it",
): TimeStripGroup[] {
  const labels = BAND_LABELS[locale];
  const byBand = new Map<TimeStripBand, TimeStripItem[]>();

  for (const m of messages) {
    const impact = m.timeImpact;
    if (!impact || impact.kind === "time_free" || !impact.timeBand) continue;
    if (impact.timeBand === "later") continue;

    const item: TimeStripItem = {
      id: m.id,
      sender: m.sender,
      subject: m.subject,
      kind: impact.kind,
      timeBand: impact.timeBand,
      deadlineHint: impact.deadlineHint,
      accountId: m.accountId,
    };

    const list = byBand.get(impact.timeBand) ?? [];
    list.push(item);
    byBand.set(impact.timeBand, list);
  }

  return BAND_ORDER.filter((band) => (byBand.get(band)?.length ?? 0) > 0).map(
    (band) => ({
      band,
      label: labels[band],
      items: byBand.get(band) ?? [],
    }),
  );
}
