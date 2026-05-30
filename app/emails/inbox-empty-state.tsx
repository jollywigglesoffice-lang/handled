"use client";

type InboxEmptyStateTone = "calm" | "attention";

type InboxEmptyStateProps = {
  title: string;
  subtitle?: string;
  footer?: string;
  tone?: InboxEmptyStateTone;
  show?: boolean;
  /** Compact variant for an empty section inside a populated inbox. */
  compact?: boolean;
};

/**
 * Calm, premium empty state — generous whitespace, one soft accent glyph,
 * clean typography. No illustrations, mascots, or gamification.
 */
export function InboxEmptyState({
  title,
  subtitle,
  footer,
  tone = "calm",
  show = true,
  compact = false,
}: InboxEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-[#EEF0F4] bg-white text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        compact ? "min-h-44 gap-2 p-8" : "min-h-64 gap-3 p-12"
      } ${show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
    >
      <span
        aria-hidden="true"
        className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted ring-1 ring-accent/15"
      >
        <EmptyGlyph tone={tone} />
      </span>
      <p
        className={`font-medium text-[#0F172A] ${compact ? "text-base" : "text-lg"}`}
      >
        {title}
      </p>
      {subtitle ? (
        <p className="max-w-sm text-sm leading-relaxed text-gray-500">{subtitle}</p>
      ) : null}
      {footer ? <p className="pt-1 text-xs text-gray-400">{footer}</p> : null}
    </div>
  );
}

function EmptyGlyph({ tone }: { tone: InboxEmptyStateTone }) {
  if (tone === "attention") {
    // Soft, settled circle — "nothing pressing", not a checklist tick.
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9733ff]" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8.5 12.2h7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // Calm check — quietly complete, no badge styling.
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#9733ff]" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.4 12.3l2.5 2.5 4.7-5.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
