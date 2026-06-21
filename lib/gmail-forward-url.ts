/** Open Gmail compose prefilled for forwarding (user sends manually). */
export function gmailForwardComposeUrl(input: {
  subject: string;
  body?: string;
  sender?: string;
}): string {
  const subject = input.subject?.trim() || "";
  const body = input.body?.trim() || "";
  const sender = input.sender?.trim() || "";
  const forwardedBody = [
    "",
    "---------- Forwarded message ---------",
    sender ? `From: ${sender}` : "",
    subject ? `Subject: ${subject}` : "",
    "",
    body,
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    tf: "1",
    su: subject ? `Fwd: ${subject}` : "Fwd:",
    body: forwardedBody,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
}
