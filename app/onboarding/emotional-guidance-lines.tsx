"use client";

type EmotionalContextLineProps = {
  line: string;
};

/** Subtle interpretation under the Step 3 email preview. */
export function EmotionalContextLine({ line }: EmotionalContextLineProps) {
  return (
    <p className="border-l-2 border-accent/20 pl-3 text-sm leading-relaxed text-gray-500">
      {line}
    </p>
  );
}

type MicroReassuranceLineProps = {
  line: string;
};

/** Calm confidence framing when the pool is thin or processing is active. */
export function MicroReassuranceLine({ line }: MicroReassuranceLineProps) {
  return (
    <p className="text-center text-xs leading-relaxed text-gray-400">{line}</p>
  );
}

type EmotionalFallbackPanelProps = {
  title: string;
  body: string;
};

export function EmotionalFallbackPanel({ title, body }: EmotionalFallbackPanelProps) {
  return (
    <div className="calm-fade-in rounded-2xl border border-emerald-100/70 bg-gradient-to-br from-emerald-50/40 to-white px-6 py-8 text-center shadow-sm">
      <p className="text-sm font-medium leading-relaxed text-gray-800">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{body}</p>
    </div>
  );
}
