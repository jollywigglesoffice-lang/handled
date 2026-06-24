import { supabaseBrowser } from "@/lib/supabase-browser";
import { getOAuthRedirectOrigin } from "@/lib/auth/app-origin";
import { protectedApiHeaders } from "@/lib/auth/protected-api-headers";

const PARENT_SESSION_KEY = "handled_attach_parent_session";

export type AttachInboxResult = { ok: true } | { ok: false; message: string };

/**
 * Attach an additional Gmail inbox via Supabase OAuth (same provider as login).
 * Preserves the current Handled session — does not re-authenticate the user.
 */
export async function startAttachInbox(options?: {
  next?: string;
}): Promise<AttachInboxResult> {
  try {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    if (!session?.refresh_token || !session.access_token) {
      return { ok: false, message: "Sign in once — then you can attach more inboxes anytime." };
    }

    sessionStorage.setItem(
      PARENT_SESSION_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }),
    );

    const attachRes = await fetch("/api/gmail/accounts/attach", {
      method: "POST",
      credentials: "include",
      headers: await protectedApiHeaders(),
    });

    if (!attachRes.ok) {
      sessionStorage.removeItem(PARENT_SESSION_KEY);
      const data = (await attachRes.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        message: data.message ?? "Could not start inbox attach.",
      };
    }

    const redirectTo =
      options?.next?.startsWith("/")
        ? `${getOAuthRedirectOrigin()}/auth/callback?attach=true&next=${encodeURIComponent(options.next)}`
        : `${getOAuthRedirectOrigin()}/auth/callback?attach=true`;

    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes:
          "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email profile",
        queryParams: {
          access_type: "offline",
          prompt: "consent select_account",
        },
      },
    });

    if (error) {
      sessionStorage.removeItem(PARENT_SESSION_KEY);
      return { ok: false, message: error.message };
    }

    return { ok: true };
  } catch {
    sessionStorage.removeItem(PARENT_SESSION_KEY);
    return { ok: false, message: "Could not start inbox attach." };
  }
}

/** @deprecated Use startAttachInbox */
export const startConnectGmailAccount = startAttachInbox;

export async function completeAttachInboxFromCallback(): Promise<{
  ok: boolean;
  message?: string;
}> {
  const {
    data: { session },
  } = await supabaseBrowser.auth.getSession();

  if (!session) {
    return { ok: false, message: "Google sign-in did not complete." };
  }

  const completeRes = await fetch("/api/gmail/accounts/attach/complete", {
    method: "POST",
    credentials: "include",
    headers: {
      ...(await protectedApiHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      providerToken: session.provider_token ?? null,
      providerRefreshToken: session.provider_refresh_token ?? null,
    }),
  });

  const completeData = (await completeRes.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };

  const parentRaw = sessionStorage.getItem(PARENT_SESSION_KEY);
  if (parentRaw) {
    try {
      const parent = JSON.parse(parentRaw) as {
        access_token: string;
        refresh_token: string;
      };
      await supabaseBrowser.auth.setSession({
        access_token: parent.access_token,
        refresh_token: parent.refresh_token,
      });
    } catch (e) {
      console.error("[attach-inbox] restore parent session failed", e);
    }
    sessionStorage.removeItem(PARENT_SESSION_KEY);
  }

  if (!completeRes.ok) {
    return {
      ok: false,
      message: completeData.message ?? "Could not save the inbox.",
    };
  }

  return { ok: true };
}

export { PARENT_SESSION_KEY };
