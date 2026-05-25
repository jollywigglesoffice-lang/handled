/** Instant detail shell from inbox row — feels prepared before API returns. */

export type EmailPreviewCache = {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  summary?: string;
  chips?: string[];
  savedAt: number;
};

const PREFIX = "handled:email-preview:";
const MAX_AGE_MS = 10 * 60 * 1000;

export function saveEmailPreview(preview: Omit<EmailPreviewCache, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: EmailPreviewCache = { ...preview, savedAt: Date.now() };
    sessionStorage.setItem(`${PREFIX}${preview.id}`, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readEmailPreview(id: string): EmailPreviewCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmailPreviewCache;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(`${PREFIX}${id}`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
