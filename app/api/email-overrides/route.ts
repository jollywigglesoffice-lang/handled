import { NextResponse } from "next/server";
import { normalizeInboxAiCategory, parseInboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  deleteEmailOverrideForUser,
  loadEmailOverridesForUser,
  saveEmailOverrideForUser,
  SETUP_SQL,
} from "@/lib/email-overrides/store";
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

  const overrides = await loadEmailOverridesForUser(auth.userId);
  return NextResponse.json({ overrides, setupSqlPath: SETUP_SQL });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  let body: {
    emailId?: string;
    category?: string;
    overriddenCategory?: string;
    originalCategory?: string | null;
    guessedCategory?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailId = body.emailId?.trim();
  if (!emailId) {
    return NextResponse.json({ error: "emailId required" }, { status: 400 });
  }

  const overriddenCategory = normalizeInboxAiCategory(
    body.overriddenCategory ?? body.category ?? "needs_attention",
  );
  const originalRaw = body.originalCategory ?? body.guessedCategory;
  const originalCategory =
    originalRaw && parseInboxAiCategory(originalRaw) ? normalizeInboxAiCategory(originalRaw) : null;

  const saved = await saveEmailOverrideForUser(auth.userId, {
    emailId,
    overriddenCategory,
    originalCategory,
  });

  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    override: saved.override,
    message: "Saved",
  });
}

export async function DELETE(request: Request) {
  const auth = await requireUserId();
  if ("error" in auth) return auth.error;

  const emailId = new URL(request.url).searchParams.get("emailId")?.trim();
  if (!emailId) {
    return NextResponse.json({ error: "emailId required" }, { status: 400 });
  }

  const deleted = await deleteEmailOverrideForUser(auth.userId, emailId);
  if (!deleted.ok) {
    return NextResponse.json(
      { error: deleted.error, setupSqlPath: SETUP_SQL },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Override removed — AI categorization restored.",
  });
}
