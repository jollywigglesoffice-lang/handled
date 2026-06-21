import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/api/route-auth";
import { normalizeInboxAiCategory, parseInboxAiCategory } from "@/lib/inbox-ai-categories";
import {
  deleteEmailOverrideForUser,
  loadEmailOverridesForUser,
  saveEmailOverrideForUser,
  SETUP_SQL,
} from "@/lib/email-overrides/store";

export async function GET(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  const overrides = await loadEmailOverridesForUser(auth.userId);

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[api/email-overrides] loaded ${overrides.length} override(s) for user ${auth.userId}`,
    );
  }

  return auth.applyAuthCookies(
    NextResponse.json({ overrides, setupSqlPath: SETUP_SQL }),
  );
}

export async function POST(request: Request) {
  const auth = await requireRouteAuth(request);
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
    return auth.applyAuthCookies(
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    );
  }

  const emailId = body.emailId?.trim();
  if (!emailId) {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "emailId required" }, { status: 400 }),
    );
  }

  const overriddenCategory = normalizeInboxAiCategory(
    body.overriddenCategory ?? body.category ?? "worth_your_attention",
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
    console.error("[api/email-overrides] save failed:", saved.error);
    return auth.applyAuthCookies(
      NextResponse.json(
        { error: saved.error, setupSqlPath: SETUP_SQL },
        { status: 502 },
      ),
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[api/email-overrides] saved ${emailId} → ${overriddenCategory} for user ${auth.userId}`,
    );
  }

  return auth.applyAuthCookies(
    NextResponse.json({
      ok: true,
      override: saved.override,
      message: "Saved",
    }),
  );
}

export async function DELETE(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  const emailId = new URL(request.url).searchParams.get("emailId")?.trim();
  if (!emailId) {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "emailId required" }, { status: 400 }),
    );
  }

  const deleted = await deleteEmailOverrideForUser(auth.userId, emailId);
  if (!deleted.ok) {
    return auth.applyAuthCookies(
      NextResponse.json(
        { error: deleted.error, setupSqlPath: SETUP_SQL },
        { status: 502 },
      ),
    );
  }

  return auth.applyAuthCookies(
    NextResponse.json({
      ok: true,
      message: "Override removed — AI categorization restored.",
    }),
  );
}
