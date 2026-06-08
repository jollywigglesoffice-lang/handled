import type { WaitingOnMetadata, WaitingOnMetadataMap } from "@/lib/waiting-on/metadata-types";

export const WAITING_ON_METADATA_KEY = "handled_waiting_on_meta_v1";
export const WAITING_ON_METADATA_EVENT = "handled-waiting-on-meta-changed";

export function parseWaitingOnMetadataJson(raw: unknown): WaitingOnMetadataMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: WaitingOnMetadataMap = {};

  for (const [emailId, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.createdAt !== "number" || typeof row.updatedAt !== "number") continue;

    const status = row.workflowStatus;
    if (status !== "waiting" && status !== "followed_up" && status !== "resolved") continue;

    out[emailId] = {
      emailId,
      note: typeof row.note === "string" ? row.note : undefined,
      workflowStatus: status,
      followUpAt: typeof row.followUpAt === "number" ? row.followUpAt : undefined,
      followedUpAt: typeof row.followedUpAt === "number" ? row.followedUpAt : undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  return out;
}

export function loadWaitingOnMetadata(): WaitingOnMetadataMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(WAITING_ON_METADATA_KEY);
    if (!raw) return {};
    return parseWaitingOnMetadataJson(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveWaitingOnMetadata(map: WaitingOnMetadataMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WAITING_ON_METADATA_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(WAITING_ON_METADATA_EVENT));
  } catch {
    /* quota */
  }
}

export function createWaitingOnMetadata(
  emailId: string,
  input?: { followUpAt?: number },
  now = Date.now(),
): WaitingOnMetadata {
  return {
    emailId,
    workflowStatus: "waiting",
    followUpAt: input?.followUpAt,
    createdAt: now,
    updatedAt: now,
  };
}
