import { NextResponse } from "next/server";
import { parseWorkflowMode, type WorkflowMode } from "@/lib/workflow-mode";
import { getWorkflowModeProfile } from "@/lib/workflow-mode/profiles";
import {
  loadWorkflowModeForUser,
  saveWorkflowModeForUser,
  SETUP_SQL,
} from "@/lib/workflow-mode/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stored = await loadWorkflowModeForUser(session.user.id);
  const mode = stored ?? "assist";

  return NextResponse.json({
    mode,
    profile: getWorkflowModeProfile(mode),
    setupSqlPath: SETUP_SQL,
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode: WorkflowMode = parseWorkflowMode(body.mode);

  const saved = await saveWorkflowModeForUser(session.user.id, mode);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode,
    profile: getWorkflowModeProfile(mode),
  });
}
