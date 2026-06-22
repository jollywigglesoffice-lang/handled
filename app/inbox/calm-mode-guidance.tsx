"use client";

type CalmModeGuidanceProps = {
  headline: string;
  reassurance?: string | null;
  recovering?: boolean;
};

/** Subtle calm-mode guidance — one reassurance, no urgency. */
export function CalmModeGuidance({
  headline,
  reassurance,
  recovering,
}: CalmModeGuidanceProps) {
  return (
    <div
      className={`space-y-1.5 rounded-2xl border px-4 py-3 calm-fade-in transition-all duration-700 ${
        recovering
          ? "border-gray-100 bg-gray-50/60"
          : "border-sky-100/80 bg-sky-50/40"
      }`}
      role="status"
    >
      <p className="text-sm leading-relaxed text-gray-700">{headline}</p>
      {reassurance ? (
        <p className="text-xs leading-relaxed text-gray-500">{reassurance}</p>
      ) : null}
    </div>
  );
}
