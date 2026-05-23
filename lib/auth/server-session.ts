import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ServerAuthSession = {
  user: User;
  session: Session;
  providerToken: string | null;
};

/** Load validated auth from cookies (prefer getUser over trusting JWT alone). */
export async function getServerAuthSession(): Promise<ServerAuthSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  return getServerAuthSessionFromClient(supabase);
}

export async function getServerAuthSessionFromClient(
  supabase: SupabaseClient,
): Promise<ServerAuthSession | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;

  return {
    user,
    session,
    providerToken: session.provider_token ?? null,
  };
}
