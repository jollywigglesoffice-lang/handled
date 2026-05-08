import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";
import {
  extractStripeId,
  resolveUserIdFromCheckoutSession,
  upsertProForUser,
} from "@/lib/stripe-pro-sync";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    console.error("[stripe-webhook] missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 500 },
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe-webhook] missing STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[stripe-webhook] signature verification failed:", msg);
    return NextResponse.json(
      { error: `Webhook Error: ${msg}` },
      { status: 400 },
    );
  }

  console.log("[stripe-webhook] received event:", event.type, "id:", event.id);

  try {
    if (event.type === "checkout.session.completed") {
      const thin = event.data.object as Stripe.Checkout.Session;

      const session = await stripe.checkout.sessions.retrieve(thin.id, {
        expand: ["subscription", "customer"],
      });

      console.log("[stripe-webhook] checkout.session.completed", {
        sessionId: session.id,
        mode: session.mode,
        payment_status: session.payment_status,
        metadata: session.metadata,
        customer: extractStripeId(session.customer),
        subscription: extractStripeId(session.subscription),
      });

      if (session.mode !== "subscription") {
        console.warn("[stripe-webhook] skipping non-subscription checkout", session.id);
        return NextResponse.json({ received: true, skipped: "not_subscription" });
      }

      if (session.payment_status !== "paid") {
        console.warn(
          "[stripe-webhook] checkout not paid yet",
          session.id,
          session.payment_status,
        );
        return NextResponse.json({ received: true, skipped: "not_paid" });
      }

      const resolved = await resolveUserIdFromCheckoutSession(stripe, supabase, session);

      console.log("[stripe-webhook] resolved user for checkout", resolved);

      if (!resolved.userId) {
        console.error(
          "[stripe-webhook] FAILED: could not resolve public.users row for checkout",
          session.id,
          { customerId: resolved.customerId, subscriptionId: resolved.subscriptionId },
        );
        return NextResponse.json(
          {
            received: true,
            error: "user_not_resolved",
            detail: "No matching userId, email, or stripe_customer_id",
          },
          { status: 200 },
        );
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
        console.error("[stripe-webhook] FAILED: Supabase upsert Pro", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 },
        );
      }

      console.log("[stripe-webhook] SUCCESS: user upgraded to Pro", {
        userId: resolved.userId,
        resolution: resolved.resolution,
        customerId,
        subscriptionId,
        rows: data,
      });
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status;
      const customerId = extractStripeId(sub.customer);
      const subscriptionId = sub.id;
      let userId = sub.metadata?.userId?.trim() || null;

      console.log("[stripe-webhook] customer.subscription.updated", {
        subscriptionId,
        status,
        userId,
        customerId,
      });

      if (status !== "active" && status !== "trialing") {
        return NextResponse.json({ received: true, skipped: "subscription_not_active" });
      }

      if (!userId && customerId) {
        const { data: row } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        userId = row?.id ?? null;
      }

      if (!userId) {
        console.warn(
          "[stripe-webhook] subscription.updated: no user id, skipping Pro upsert",
        );
        return NextResponse.json({ received: true, skipped: "no_user" });
      }

      const { data, error } = await upsertProForUser(supabase, {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });

      if (error) {
        console.error("[stripe-webhook] subscription.updated Supabase error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log("[stripe-webhook] SUCCESS: Pro synced from subscription.updated", {
        userId,
        data,
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      const userId = subscription.metadata?.userId?.trim();
      const customerId = extractStripeId(subscription.customer);

      console.log("[stripe-webhook] customer.subscription.deleted", {
        userId,
        customerId,
      });

      if (userId) {
        const { error } = await supabase
          .from("users")
          .update({ is_pro: false })
          .eq("id", userId);
        if (error) {
          console.error("[stripe-webhook] downgrade by userId failed", error);
        } else {
          console.log("[stripe-webhook] SUCCESS: Pro cleared for user", userId);
        }
      } else if (customerId) {
        const { error } = await supabase
          .from("users")
          .update({ is_pro: false })
          .eq("stripe_customer_id", customerId);
        if (error) {
          console.error("[stripe-webhook] downgrade by customer failed", error);
        } else {
          console.log("[stripe-webhook] SUCCESS: Pro cleared for customer", customerId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Webhook handler failed";
    console.error("[stripe-webhook] handler exception:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
