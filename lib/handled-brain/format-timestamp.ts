export function formatBrainLastUpdated(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatRelativeBrainSync(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 30) return "Synced just now";
  if (sec < 3600) return `Synced ${Math.floor(sec / 60)}m ago`;
  return `Synced ${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}
