import { NextResponse } from "next/server";
import type { UserIdentity } from "@/lib/user-identity/types";
import { EMPTY_IDENTITY } from "@/lib/user-identity/types";
import { parseUserIdentityJson } from "@/lib/user-identity/client-storage";
import {
  loadUserIdentityForUser,
  saveUserIdentityForUser,
} from "@/lib/user-identity/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SETUP_SQL = "supabase/sql/inbox_personalization_setup.sql";

async function requireUserId(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Server misconfigured" }, { status: 500 }) };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const identity = await loadUserIdentityForUser(auth.userId);
  const hasData = Boolean(identity.displayName.trim());
  return NextResponse.json({
    identity: hasData ? identity : EMPTY_IDENTITY,
    setupSqlPath: SETUP_SQL,
  });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { identity?: UserIdentity };
  try {
    body = (await request.json()) as { identity?: UserIdentity };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identity = parseUserIdentityJson(body.identity ?? EMPTY_IDENTITY);
  const saved = await saveUserIdentityForUser(auth.userId, identity);

  if (!saved.ok) {
    if (saved.clientLocalOk) {
      return NextResponse.json({
        ok: true,
        identity,
        storageMode: "client_local",
        message: "Saved on this device. Run setup SQL for cloud sync.",
        setupSqlPath: SETUP_SQL,
      });
    }
    return NextResponse.json({ error: saved.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    identity,
    storageMode: "cloud",
    message: "Identity saved.",
  });
}
