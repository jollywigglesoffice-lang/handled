/** Sparse continuity copy — no card chrome. */
export function ContinuityLines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <ul className="space-y-1.5" aria-label="Thread context">
      {lines.map((line) => (
        <li key={line} className="text-sm leading-relaxed text-gray-600">
          {line}
        </li>
      ))}
    </ul>
  );
}
