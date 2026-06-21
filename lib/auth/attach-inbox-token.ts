import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const COOKIE_NAME = "handled_attach_inbox";
const TTL_MS = 15 * 60 * 1000;

type AttachPayload = {
  userId: string;
  nonce: string;
  ts: number;
};

function attachSecret(): string | null {
  return (
    process.env.TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export const ATTACH_INBOX_COOKIE = COOKIE_NAME;

export function signAttachInboxToken(userId: string): string | null {
  const secret = attachSecret();
  if (!secret) return null;

  const payload: AttachPayload = {
    userId,
    nonce: randomBytes(16).toString("hex"),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAttachInboxToken(token: string): string | null {
  const secret = attachSecret();
  if (!secret) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as AttachPayload;
    if (!payload.userId || !payload.nonce) return null;
    if (Date.now() - payload.ts > TTL_MS) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function attachInboxCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  };
}
