import { NextResponse } from "next/server";
import {
  recordMemoryInteraction,
  recordEmailOpenSignal,
  recordEmailViewedWithoutAction,
  upsertActionMemory,
} from "@/lib/memory-engine/store";
import type { MemoryCollectPayload } from "@/lib/memory-engine/types";
import { integrateProductFeedbackWithMemory } from "@/lib/memory-engine/feedback-bridge";
import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createRouteHandlerSupabase } from "@/lib/supabase/route-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { supabase, applyAuthCookies } = createRouteHandlerSupabase(request);
  const authResult = await requireApiAuth(request, supabase);
  if (!authResult.ok) {
    return applyAuthCookies(authResult.response);
  }

  let body: MemoryCollectPayload;
  try {
    body = (await request.json()) as MemoryCollectPayload;
  } catch {
    return applyAuthCookies(NextResponse.json({ error: "invalid_json" }, { status: 400 }));
  }

  const userId = authResult.auth.user.id;
  const context = body.context ?? "inbox";

  try {
    if (body.action === "feedback" && body.feedbackCategory) {
      await integrateProductFeedbackWithMemory({
        userId,
        category: body.feedbackCategory as import("@/lib/product-feedback/types").FeedbackCategory,
        message: body.feedbackMessage ?? "",
        screenContext: null,
      });
      return applyAuthCookies(NextResponse.json({ ok: true }));
    }

    if (body.action === "category_correction" || body.action === "user_override") {
      const userCategory = body.chosenCategory ?? body.category;
      const aiCategory = body.guessedCategory ?? body.previousCategory ?? userCategory;
      if (!userCategory || !body.sender) {
        return applyAuthCookies(NextResponse.json({ ok: true, skipped: true }));
      }

      await recordMemoryInteraction({
        userId,
        emailId: body.emailId,
        accountId: body.accountId,
        sender: body.sender,
        subject: body.subject,
        aiCategory: aiCategory ?? null,
        userCategory,
        actionTaken: body.action,
        categoryBefore: body.previousCategory ?? body.guessedCategory ?? null,
        categoryAfter: userCategory,
        context,
        correctionReason: body.correctionReason ?? body.scope,
        scope: body.scope,
      });
    }

    if (body.action === "email_opened" && body.sender) {
      await recordEmailOpenSignal({
        userId,
        emailId: body.emailId,
        accountId: body.accountId,
        sender: body.sender,
        aiCategory: body.guessedCategory ?? body.category ?? null,
        context,
      });
    }

    if (body.action === "email_viewed_no_action" && body.sender) {
      await recordEmailViewedWithoutAction({
        userId,
        emailId: body.emailId,
        accountId: body.accountId,
        sender: body.sender,
        subject: body.subject,
        aiCategory: body.guessedCategory ?? body.category ?? null,
        context,
      });
    }

    if (body.action === "completion_action" && body.actionId && body.sender) {
      const category = body.chosenCategory ?? body.category ?? "worth_your_attention";
      await upsertActionMemory({
        userId,
        sender: body.sender,
        category,
        actionId: body.actionId,
      });
      await recordMemoryInteraction({
        userId,
        emailId: body.emailId,
        accountId: body.accountId,
        sender: body.sender,
        subject: body.subject,
        aiCategory: category,
        userCategory: category,
        actionTaken: body.actionId,
        categoryBefore: category,
        categoryAfter: category,
        context,
      });
    }

    return applyAuthCookies(NextResponse.json({ ok: true }));
  } catch (e) {
    console.error("[api/memory/collect]", e);
    return applyAuthCookies(
      NextResponse.json({ error: "memory_collect_failed" }, { status: 500 }),
    );
  }
}
