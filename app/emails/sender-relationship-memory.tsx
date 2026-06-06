"use client";

import { useMemo } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { buildSenderRelationshipMemory } from "@/lib/relationship-memory";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

const COPY = {
  en: {
    usuallyCategorized: "Usually categorized",
    typicalCompletion: "Typical completion",
    lastInteraction: "Last interaction",
    waitingOn: "Waiting on",
  },
  it: {
    usuallyCategorized: "Di solito categorizzata come",
    typicalCompletion: "Completamento tipico",
    lastInteraction: "Ultima interazione",
    waitingOn: "In attesa di",
  },
} as const;

type SenderRelationshipMemoryCardProps = {
  sender: string;
  relationship?: SenderRelationshipProfile | null;
  locale: "en" | "it";
  currentEmailMs?: number;
};

export function SenderRelationshipMemoryCard({
  sender,
  relationship,
  locale,
  currentEmailMs,
}: SenderRelationshipMemoryCardProps) {
  const { completions } = useEmailCompletions();
  const { catalog } = useInboxCategories();
  const t = COPY[locale];

  const memory = useMemo(
    () =>
      buildSenderRelationshipMemory({
        senderLine: sender,
        completions,
        relationship,
        locale,
        catalog,
        currentEmailMs,
      }),
    [sender, completions, relationship, locale, catalog, currentEmailMs],
  );

  if (!memory) return null;

  return (
    <section className="border-l-2 border-[#E8ECF1] pl-3">
      <p className="text-sm font-medium text-gray-600">{memory.profileName}</p>
      <dl className="mt-1.5 space-y-1 text-sm text-gray-600">
        {memory.typicalCategory ? (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-gray-400">{t.usuallyCategorized}:</dt>
            <dd>{memory.typicalCategory}</dd>
          </div>
        ) : null}

        {memory.typicalCompletion ? (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-gray-400">{t.typicalCompletion}:</dt>
            <dd>{memory.typicalCompletion}</dd>
          </div>
        ) : null}

        {memory.waitingOnSummary ? (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-gray-400">{t.waitingOn}:</dt>
            <dd>{memory.waitingOnSummary}</dd>
          </div>
        ) : null}

        {memory.lastInteraction ? (
          <div className="flex flex-wrap gap-x-1.5">
            <dt className="text-gray-400">{t.lastInteraction}:</dt>
            <dd>{memory.lastInteraction}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
