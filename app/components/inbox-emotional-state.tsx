import {
  inboxEmotionalLabel,
  inboxEmotionalTone,
  type InboxEmotionalState,
} from "@/lib/inbox-emotional-state";

/** Exactly one visible emotional state — replaces competing tag chips. */
export function InboxEmotionalStateIndicator({
  state,
  locale,
}: {
  state: InboxEmotionalState;
  locale: "en" | "it";
}) {
  const tone = inboxEmotionalTone(state);
  const label = inboxEmotionalLabel(state, locale);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide ${tone.text}`}
      aria-label={label}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      {label}
    </span>
  );
}
