import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/api/route-auth";
import { normalizePersonalCompletionActions } from "@/lib/completion-actions/storage";
import {
  loadCompletionActionsForUser,
  saveCompletionActionsForUser,
  SETUP_SQL,
} from "@/lib/completion-actions/store";
import type { PersonalCompletionAction } from "@/lib/completion-actions/types";

export async function GET(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  const actions = await loadCompletionActionsForUser(auth.userId);
  return auth.applyAuthCookies(
    NextResponse.json({ actions, setupSqlPath: SETUP_SQL }),
  );
}

export async function PUT(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  let body: { actions?: PersonalCompletionAction[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    );
  }

  const actions = normalizePersonalCompletionActions(body.actions ?? []);
  const saved = await saveCompletionActionsForUser(auth.userId, actions);

  if (!saved.ok) {
    return auth.applyAuthCookies(
      NextResponse.json(
        { error: saved.error, clientLocalOk: saved.clientLocalOk ?? false, actions },
        { status: saved.clientLocalOk ? 200 : 500 },
      ),
    );
  }

  return auth.applyAuthCookies(NextResponse.json({ ok: true, actions }));
}
