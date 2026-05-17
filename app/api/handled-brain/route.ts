import { NextResponse } from "next/server";
import type { HandledBrain } from "@/lib/handled-brain/types";
import { EMPTY_BRAIN } from "@/lib/handled-brain/types";
import {
  loadHandledBrainForUser,
  saveHandledBrainForUser,
} from "@/lib/handled-brain/store";
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

  const brain = await loadHandledBrainForUser(auth.userId);
  return NextResponse.json({ brain: brain.entries.length ? brain : EMPTY_BRAIN, setupSqlPath: SETUP_SQL });
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
        ok: true,
        brain,
        storageMode: "client_local",
        message: "Saved on this device. Run setup SQL for cloud sync.",
        setupSqlPath: SETUP_SQL,
      });
    }
    return NextResponse.json({ error: saved.error, setupSqlPath: SETUP_SQL }, { status: 502 });
  }

  return NextResponse.json({ ok: true, brain, storageMode: "cloud", message: "Handled Brain saved." });
}
