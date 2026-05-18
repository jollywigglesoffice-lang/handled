import type { UserIdentity } from "@/lib/user-identity/types";
import { EMPTY_IDENTITY } from "@/lib/user-identity/types";

export const USER_IDENTITY_STORAGE_KEY = "handled:user-identity";

export function parseUserIdentityJson(raw: unknown): UserIdentity {
  if (!raw || typeof raw !== "object") return { ...EMPTY_IDENTITY };
  const o = raw as UserIdentity;
  return {
    displayName: typeof o.displayName === "string" ? o.displayName : "",
    fullName: typeof o.fullName === "string" ? o.fullName : undefined,
    businessTitle: typeof o.businessTitle === "string" ? o.businessTitle : undefined,
    companyName: typeof o.companyName === "string" ? o.companyName : undefined,
    defaultSignOff:
      o.defaultSignOff === "thanks" ||
      o.defaultSignOff === "regards" ||
      o.defaultSignOff === "warm_regards" ||
      o.defaultSignOff === "none"
        ? o.defaultSignOff
        : "best",
    customSignOff: typeof o.customSignOff === "string" ? o.customSignOff : undefined,
    signatureBlock: typeof o.signatureBlock === "string" ? o.signatureBlock : undefined,
    communicationStyle:
      o.communicationStyle === "professional" ||
      o.communicationStyle === "casual" ||
      o.communicationStyle === "balanced"
        ? o.communicationStyle
        : "balanced",
    includeSignOffInReplies: o.includeSignOffInReplies !== false,
    updatedAt: typeof o.updatedAt === "number" ? o.updatedAt : undefined,
  };
}

export function loadClientUserIdentity(): UserIdentity {
  if (typeof window === "undefined") return { ...EMPTY_IDENTITY };
  try {
    const raw = localStorage.getItem(USER_IDENTITY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_IDENTITY };
    return parseUserIdentityJson(JSON.parse(raw));
  } catch {
    return { ...EMPTY_IDENTITY };
  }
}

export function saveClientUserIdentity(identity: UserIdentity): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      USER_IDENTITY_STORAGE_KEY,
      JSON.stringify({ ...identity, updatedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function parseUserIdentityHeader(header: string | null): UserIdentity | null {
  if (!header?.trim()) return null;
  try {
    const json = decodeURIComponent(header);
    return parseUserIdentityJson(JSON.parse(json));
  } catch {
    return null;
  }
}

export function serializeUserIdentityHeader(identity: UserIdentity): string {
  return encodeURIComponent(JSON.stringify(identity));
}
