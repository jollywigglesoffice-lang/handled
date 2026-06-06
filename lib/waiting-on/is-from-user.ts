import { resolveSenderIdentity } from "@/lib/sender-identity";

/** True when the message sender is the authenticated user (not an inbound reply). */
export function isSenderUser(
  messageSender: string,
  userEmail: string | undefined | null,
): boolean {
  const email = userEmail?.trim().toLowerCase();
  if (!email) return false;

  const sender = resolveSenderIdentity(messageSender);
  const user = resolveSenderIdentity(email);

  if (sender.email && user.email && sender.email === user.email) return true;
  if (sender.email && sender.email === email) return true;

  return false;
}
