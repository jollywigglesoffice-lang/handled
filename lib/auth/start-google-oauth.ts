import { supabaseBrowser } from "@/lib/supabase-browser";
import { getOAuthRedirectOrigin } from "@/lib/auth/app-origin";

export async function startGoogleOAuth(next = "/emails"): Promise<{ error?: string }> {
  const redirectTo = `${getOAuthRedirectOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabaseBrowser.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes:
        "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email profile",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google OAuth error", error);
    return { error: error.message };
  }

  return {};
}
