"use client";

type GuideMessageProps = {
  children: React.ReactNode;
  variant?: "guide" | "ack" | "continuity";
};

/** Conversational guide bubble — feels like a person, not a wizard step. */
export function GuideMessage({ children, variant = "guide" }: GuideMessageProps) {
  const styles =
    variant === "ack"
      ? "border-accent/20 bg-accent-muted/15 text-gray-800"
      : variant === "continuity"
        ? "border-gray-100 bg-gray-50/80 text-gray-600"
        : "border-gray-100 bg-white text-gray-700 shadow-sm";

  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed calm-fade-in ${styles}`}
    >
      {children}
    </p>
  );
}
