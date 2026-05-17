"use client";

import { useMemo, useState } from "react";
import {
  detectUnsubscribeOptions,
  type UnsubscribeDetection,
} from "@/lib/detect-unsubscribe";

type UnsubscribeCardProps = {
  bodyPlain: string;
  bodyHtml?: string;
  sender: string;
};

export function UnsubscribeCard({ bodyPlain, bodyHtml, sender }: UnsubscribeCardProps) {
  const options = useMemo(
    () => detectUnsubscribeOptions(bodyPlain, bodyHtml),
    [bodyPlain, bodyHtml],
  );
  const [copied, setCopied] = useState<string | null>(null);

  if (options.length === 0) return null;

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
      <p className="text-sm font-semibold text-amber-900">Unsubscribe options</p>
      <p className="mt-1 text-xs text-amber-800/90">
        Handled detected ways to leave this mailing list. You approve every action — nothing sends
        automatically.
      </p>
      <ul className="mt-4 space-y-3">
        {options.map((opt, i) => (
          <li key={`${opt.type}-${i}`}>
            <UnsubscribeAction
              option={opt}
              copied={copied === `${opt.type}-${i}`}
              onCopy={(t) => void copyText(t, `${opt.type}-${i}`)}
            />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-amber-700/80">From: {sender}</p>
    </section>
  );
}

function UnsubscribeAction({
  option,
  copied,
  onCopy,
}: {
  option: UnsubscribeDetection;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  if (option.type === "link") {
    if (!option.url) {
      return (
        <p className="text-sm text-amber-900">
          {option.label} — open the full email body below to find the link.
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={option.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Unsubscribe instantly
        </a>
        <span className="text-xs text-amber-800">Opens sender&apos;s unsubscribe page</span>
      </div>
    );
  }

  if (option.type === "reply") {
    return (
      <div className="rounded-lg border border-amber-200 bg-white p-3">
        <p className="text-xs font-medium text-amber-900">{option.instruction}</p>
        <p className="mt-2 font-mono text-sm text-gray-800">{option.suggestedReply}</p>
        <button
          type="button"
          onClick={() => onCopy(option.suggestedReply)}
          className="mt-2 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50"
        >
          {copied ? "Copied" : "Copy unsubscribe reply"}
        </button>
      </div>
    );
  }

  const mailto = `mailto:${option.email}?subject=${encodeURIComponent(option.subject ?? "Unsubscribe")}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={mailto}
        className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
      >
        Email to unsubscribe
      </a>
      <button
        type="button"
        onClick={() =>
          onCopy(
            `Please unsubscribe me from future emails.\n\nThank you.`,
          )
        }
        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50"
      >
        {copied ? "Copied" : "Copy: Please unsubscribe me…"}
      </button>
    </div>
  );
}

function div({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={className}>{children}</div>;
}
