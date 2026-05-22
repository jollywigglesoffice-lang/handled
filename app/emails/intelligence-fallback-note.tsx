"use client";

type IntelligenceFallbackNoteProps = {
  message: string;
};

/** Calm placeholder when optional AI enrichment is unavailable. */
export function IntelligenceFallbackNote({ message }: IntelligenceFallbackNoteProps) {
  return (
    <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-500">
      {message}
    </p>
  );
}
