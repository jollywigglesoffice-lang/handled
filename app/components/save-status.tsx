"use client";

export type SaveStatusState = "idle" | "saving" | "saved" | "synced" | "offline" | "error";

const LABELS: Record<SaveStatusState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  synced: "Synced",
  offline: "Saved on this device",
  error: "Could not save",
};

type SaveStatusProps = {
  status: SaveStatusState;
  className?: string;
};

export function SaveStatus({ status, className = "" }: SaveStatusProps) {
  if (status === "idle") return null;

  const tone =
    status === "error"
      ? "text-rose-600"
      : status === "offline"
        ? "text-amber-700"
        : status === "saving"
          ? "text-gray-500"
          : "text-emerald-700";

  return (
    <span
      className={`text-xs font-medium tabular-nums ${tone} ${className}`}
      role="status"
      aria-live="polite"
    >
      {LABELS[status]}
    </span>
  );
}
