"use client";

type CategoryUndoToastProps = {
  message: string;
  undoLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
};

/** Calm bottom snackbar — Gmail/Linear-style undo. */
export function CategoryUndoToast({
  message,
  undoLabel,
  onUndo,
  onDismiss,
}: CategoryUndoToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-4 rounded-xl border border-accent/20 bg-[#0F172A] px-4 py-3 text-sm text-white shadow-lg shadow-accent/10 ring-1 ring-accent/30">
        <span className="min-w-0 flex-1 whitespace-pre-line font-medium leading-snug">
          {message}
        </span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#9733ff] transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9733ff]"
        >
          {undoLabel}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
