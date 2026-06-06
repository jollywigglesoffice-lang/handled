"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useEmailCompletions } from "@/app/email-completions-context";
import { useInboxCategories } from "@/app/inbox-categories-context";
import { RelationshipBadge } from "@/app/emails/relationship-badge";
import { buildSenderRelationshipMemory } from "@/lib/relationship-memory";
import type { SenderRelationshipProfile } from "@/lib/relationship-intelligence/types";

const COPY = {
  en: {
    title: "Relationship memory",
    usually: "Usually",
    typicalCompletion: "Typical completion",
    recentActivity: "Recent activity",
    waitingOn: "Open Waiting On",
    noPatterns: "Handled is still learning this sender.",
  },
  it: {
    title: "Memoria relazione",
    usually: "Di solito",
    typicalCompletion: "Completamento tipico",
    recentActivity: "Attività recente",
    waitingOn: "Apri In attesa",
    noPatterns: "Handled sta ancora imparando questo mittente.",
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

  const hasPatterns =
    memory.typicalCategory ||
    memory.typicalCompletion ||
    memory.lastInteractionLabel ||
    memory.waitingItems.length > 0 ||
    memory.recentActivity.length > 0;

  return (
    <section className="rounded-xl border border-[#E8ECF1] bg-[#FAFBFC] px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-[#0F172A]">{memory.profileName}</h2>
        {relationship ? <RelationshipBadge relationship={relationship} /> : null}
      </div>

      {!hasPatterns ? (
        <p className="mt-2 text-sm text-gray-500">{t.noPatterns}</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          {memory.typicalCategory ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-gray-500">{t.usually}</dt>
              <dd className="font-medium text-[#0F172A]">{memory.typicalCategory}</dd>
            </div>
          ) : null}

          {memory.typicalCompletion ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-gray-500">{t.typicalCompletion}</dt>
              <dd className="font-medium text-[#0F172A]">{memory.typicalCompletion}</dd>
            </div>
          ) : null}

          {memory.lastInteractionLabel ? (
            <div>
              <dd>{memory.lastInteractionLabel}</dd>
            </div>
          ) : null}

          {memory.waitingItems.map((item) => (
            <div
              key={item.emailId}
              className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2"
            >
              <p className="font-medium text-amber-950">{item.label}</p>
              <p className="text-xs text-amber-900/80">{item.relative}</p>
              <Link
                href="/emails/waiting"
                className="mt-1 inline-block text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              >
                {t.waitingOn}
              </Link>
            </div>
          ))}
        </dl>
      )}

      {memory.recentActivity.length > 0 ? (
        <div className="mt-4 border-t border-[#EEF2F6] pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            {t.recentActivity}
          </p>
          <ul className="mt-2 space-y-2">
            {memory.recentActivity.map((item) => (
              <li key={item.emailId}>
                <Link
                  href={`/emails/${encodeURIComponent(item.emailId)}`}
                  className="block rounded-lg px-1 py-0.5 transition hover:bg-white"
                >
                  <p className="truncate text-sm font-medium text-[#0F172A]">{item.subject}</p>
                  <p className="text-xs text-gray-500">
                    {item.actionLabel} · {item.relative}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
