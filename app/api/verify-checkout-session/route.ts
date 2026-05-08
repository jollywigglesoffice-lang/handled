import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractStripeId,
  resolveUserIdFromCheckoutSession,
  upsertProForUser,
} from "@/lib/stripe-pro-sync";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("verify-checkout-session: missing STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: { sessionId?: unknown };
  try {
    body = (await req.json()) as { sessionId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  if (!authClient) {
    console.error("verify-checkout-session: no Supabase server client");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user?.id) {
    console.warn("verify-checkout-session: unauthenticated request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    console.log("verify-checkout-session: retrieved", {
      sessionId: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      metadata: session.metadata,
    });

    if (session.mode !== "subscription") {
      return NextResponse.json({ ok: false, reason: "not_subscription" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        ok: false,
        reason: "not_paid",
        payment_status: session.payment_status,
      });
    }

    const resolved = await resolveUserIdFromCheckoutSession(stripe, supabase, session);

    console.log("verify-checkout-session: resolve", {
      ...resolved,
      authUserId: user.id,
    });

    if (!resolved.userId) {
      console.error("verify-checkout-session: could not resolve user row");
      return NextResponse.json({ ok: false, reason: "user_not_resolved" }, { status: 422 });
    }

    if (resolved.userId !== user.id) {
      console.error("verify-checkout-session: forbidden user mismatch", {
        resolved: resolved.userId,
        sessionUser: user.id,
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const customerId =
      resolved.customerId || extractStripeId(session.customer);
    const subscriptionId =
      resolved.subscriptionId || extractStripeId(session.subscription);

    const { data, error } = await upsertProForUser(supabase, {
      userId: resolved.userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

    if (error) {
      console.error("verify-checkout-session: Supabase upsert failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("verify-checkout-session: Pro applied", {
      userId: resolved.userId,
      customerId,
      subscriptionId,
      rows: data,
    });

    return NextResponse.json({
      ok: true,
      isPro: true,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "verify failed";
    console.error("verify-checkout-session: error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
