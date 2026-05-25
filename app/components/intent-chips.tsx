/** Subtle contextual tags — scannable, not classifier labels. */
export function IntentChips({ chips }: { chips: string[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Context">
      {chips.map((chip) => {
        const highlight =
          /reply recommended|risposta consigliata|time-sensitive|urgenza/i.test(chip);
        return (
          <span
            key={chip}
            role="listitem"
            className={
              highlight
                ? "rounded-md bg-accent-muted/50 px-2 py-0.5 text-[11px] font-medium text-accent"
                : "rounded-md bg-gray-100/90 px-2 py-0.5 text-[11px] font-medium text-gray-500"
            }
          >
            {chip}
          </span>
        );
      })}
    </div>
  );
}
