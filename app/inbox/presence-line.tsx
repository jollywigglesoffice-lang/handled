"use client";

type PresenceLineProps = {
  line: string;
};

/** Quiet observation — not an announcement, not a notification. */
export function PresenceLine({ line }: PresenceLineProps) {
  return (
    <p
      className="text-xs leading-relaxed text-gray-400 calm-fade-in"
      aria-hidden
    >
      {line}
    </p>
  );
}
