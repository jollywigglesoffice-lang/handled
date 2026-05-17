import type { SenderPreference } from "@/lib/inbox-sender-preferences";

export { isUsersJsonColumnMissingError } from "@/lib/inbox-user-rules/storage";

export function parseSenderPreferencesJson(value: unknown): SenderPreference[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is SenderPreference =>
      !!item &&
      typeof item === "object" &&
      typeof (item as SenderPreference).senderEmail === "string" &&
      typeof (item as SenderPreference).category === "string",
  );
}
