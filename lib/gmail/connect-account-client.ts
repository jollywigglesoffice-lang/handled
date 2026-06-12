import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";

/** Start the OAuth flow to connect an additional Gmail account. */
export async function startConnectGmailAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/gmail/accounts", {
      method: "POST",
      headers: await protectedApiHeaders(),
    });
    const data = (await res.json()) as { url?: string; message?: string };
    if (!res.ok || !data.url) {
      return { ok: false, message: data.message ?? "Could not start Gmail connection." };
    }
    window.location.href = data.url;
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not start Gmail connection." };
  }
}
