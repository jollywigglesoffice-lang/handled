import { NextResponse } from "next/server";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type ProductFeedbackPayload,
} from "@/lib/product-feedback/types";
import { saveProductFeedback } from "@/lib/product-feedback/store";
import { integrateProductFeedbackWithMemory } from "@/lib/memory-engine/feedback-bridge";
import { requireRouteAuth } from "@/lib/api/route-auth";

export const dynamic = "force-dynamic";

function isValidCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const auth = await requireRouteAuth(request);
  if ("error" in auth) return auth.error;

  let body: ProductFeedbackPayload;
  try {
    body = (await request.json()) as ProductFeedbackPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length < 3) {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "message_required" }, { status: 400 }),
    );
  }

  if (!body.category || !isValidCategory(body.category)) {
    return auth.applyAuthCookies(
      NextResponse.json({ error: "invalid_category" }, { status: 400 }),
    );
  }

  const screenContext =
    body.includeContext && body.context ? body.context : null;

  try {
    const { stored } = await saveProductFeedback({
      userId: auth.userId,
      category: body.category,
      message: message.slice(0, 4000),
      screenContext,
    });

    void integrateProductFeedbackWithMemory({
      userId: auth.userId,
      category: body.category,
      message,
      screenContext,
    }).catch((e) => console.warn("[product-feedback] memory bridge", e));

    return auth.applyAuthCookies(
      NextResponse.json({ ok: true, stored }),
    );
  } catch (e) {
    console.error("[api/product-feedback]", e);
    return auth.applyAuthCookies(
      NextResponse.json({ error: "feedback_failed" }, { status: 500 }),
    );
  }
}
