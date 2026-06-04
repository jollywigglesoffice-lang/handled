import { NextResponse } from "next/server";
import { requireRouteAuth } from "@/lib/api/route-auth";
import { normalizePersonalCategoriesList } from "@/lib/personal-categories/storage";
import {
  loadPersonalCategoriesForUser,
  savePersonalCategoriesForUser,
  SETUP_SQL,
} from "@/lib/personal-categories/store";
import type { PersonalInboxCategory } from "@/lib/personal-categories/types";

export async function GET(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  const categories = await loadPersonalCategoriesForUser(auth.userId);
  return auth.applyAuthCookies(
    NextResponse.json({ categories, setupSqlPath: SETUP_SQL }),
  );
}

export async function PUT(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  let body: { categories?: PersonalInboxCategory[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    );
  }

  const categories = normalizePersonalCategoriesList(body.categories ?? []);
  const saved = await savePersonalCategoriesForUser(auth.userId, categories);

  if (!saved.ok) {
    return auth.applyAuthCookies(
      NextResponse.json(
        {
          error: saved.error,
          clientLocalOk: saved.clientLocalOk ?? false,
          categories,
        },
        { status: saved.clientLocalOk ? 200 : 500 },
      ),
    );
  }

  return auth.applyAuthCookies(NextResponse.json({ ok: true, categories }));
}
