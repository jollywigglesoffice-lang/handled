import { NextResponse } from "next/server";
import type { HandledBrain } from "@/lib/handled-brain/types";
import { EMPTY_BRAIN } from "@/lib/handled-brain/types";
import {
  loadHandledBrainForUser,
  saveHandledBrainForUser,
  SETUP_SQL,
} from "@/lib/handled-brain/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const brain = await loadHandledBrainForUser(auth.userId);
  const hasContent = brain.entries.length > 0 || Boolean(brain.writingStyle?.trim());

  return NextResponse.json({
    brain: hasContent ? brain : EMPTY_BRAIN,
    storageMode: "cloud",
    setupSqlPath: SETUP_SQL,
  });
}

export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: { brain?: HandledBrain };
  try {
    body = (await request.json()) as { brain?: HandledBrain };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brain = body.brain ?? EMPTY_BRAIN;
  const saved = await saveHandledBrainForUser(auth.userId, brain);

  if (!saved.ok) {
    if (saved.clientLocalOk) {
      return NextResponse.json({
        ok: false,
        brain,
        storageMode: "client_local",
        syncStatus: "offline_cached",
        message: saved.hint
          ? `${saved.error} (${saved.hint})`
          : "Could not sync — keep editing; we'll retry when online.",
        setupSqlPath: SETUP_SQL,
      }, { status: 503 });
    }
    return NextResponse.json(
      { error: saved.error, setupSqlPath: SETUP_SQL, syncStatus: "error" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    brain,
    storageMode: "cloud",
    syncStatus: "saved",
    message: saved.message,
    lastSyncedAt: saved.lastSyncedAt,
  });
}
