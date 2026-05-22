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

async function getSessionUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    console.error("[api/user-identity] server misconfigured");
    return null;
  }
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    console.error("[api/user-identity] getSession error", error.message);
    return null;
  }
  if (!session?.user?.id) {
    console.error(
      "[api/user-identity] no server session — returning EMPTY_IDENTITY (email pages must not depend on this)",
    );
    return null;
  }
  return session.user.id;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({
      identity: EMPTY_IDENTITY,
      authenticated: false,
      setupSqlPath: SETUP_SQL,
    });
  }

  const identity = await loadUserIdentityForUser(userId);
  const hasData = Boolean(identity.displayName.trim());
  return NextResponse.json({
    identity: hasData ? identity : EMPTY_IDENTITY,
    authenticated: true,
    setupSqlPath: SETUP_SQL,
  });
}

export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    console.error("[api/user-identity] PUT unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { identity?: UserIdentity };
  try {
    body = (await request.json()) as { identity?: UserIdentity };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identity = parseUserIdentityJson(body.identity ?? EMPTY_IDENTITY);
  const saved = await saveUserIdentityForUser(userId, identity);

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
