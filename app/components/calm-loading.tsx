"use client";

import type { ReactNode } from "react";

type CalmAiPreparingProps = {
  label?: string;
  className?: string;
};

/** Subtle accent pulse while AI prepares — no spinner. */
export function CalmAiPreparing({ label, className = "" }: CalmAiPreparingProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} role="status" aria-live="polite">
      <span className="calm-accent-pulse h-2 w-2 shrink-0 rounded-full" aria-hidden />
      {label ? <span className="text-sm text-gray-500">{label}</span> : null}
    </div>
  );
}

/** Lightweight typing indicator — three soft dots. */
export function CalmTypingIndicator({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="status"
      aria-label="Preparing"
    >
      <span className="calm-typing-dot" />
      <span className="calm-typing-dot calm-typing-dot-2" />
      <span className="calm-typing-dot calm-typing-dot-3" />
    </span>
  );
}

export function CalmShimmerBlock({
  className = "",
  accent = false,
}: {
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg ${accent ? "accent-shimmer" : "subtle-shimmer"} ${className}`}
      aria-hidden
    />
  );
}

export function CalmShimmerLines({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-3/5"];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3.5 rounded-md subtle-shimmer ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

export function CalmFadeIn({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={`calm-fade-in ${className}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
