/** Plain-text block sent to the reply model (subject + sender + body). */
export function buildReplyEmailContext(input: {
  sender: string;
  subject: string;
  body: string;
  snippet?: string;
}): string {
  const body = input.body.trim() || input.snippet?.trim() || "";
  const parts = [
    `From: ${input.sender.trim() || "Unknown sender"}`,
    `Subject: ${input.subject.trim() || "(no subject)"}`,
    "",
    body || "(no message body — use subject and sender only)",
  ];
  return parts.join("\n").slice(0, 12_000);
}
