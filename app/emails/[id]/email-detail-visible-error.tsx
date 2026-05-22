type EmailDetailVisibleErrorProps = {
  label: string;
  error: unknown;
};

export function formatDetailError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2);
  } catch {
    return String(error);
  }
}

export function EmailDetailVisibleError({ label, error }: EmailDetailVisibleErrorProps) {
  return (
    <div style={{ padding: 20, color: "red", fontFamily: "monospace" }}>
      {label}
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{formatDetailError(error)}</pre>
    </div>
  );
}
