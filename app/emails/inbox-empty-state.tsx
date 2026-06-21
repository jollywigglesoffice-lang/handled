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
 * Zero-state — borderless, calm, subtle animation. The inbox at rest.
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
      className={`flex flex-col items-center justify-center text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        compact ? "gap-2 py-10" : "gap-3 py-16"
      } ${show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}
    >
      <span
        aria-hidden="true"
        className={`mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 ${
          tone === "calm" ? "calm-zero-pulse" : ""
        }`}
      >
        <EmptyGlyph tone={tone} />
      </span>
      <p className={`font-medium text-gray-800 ${compact ? "text-base" : "text-lg"}`}>
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
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" aria-hidden>
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
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-gray-400" fill="none" aria-hidden>
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
