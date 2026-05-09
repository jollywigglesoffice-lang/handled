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
      let customerId = extractStripeId(session.customer);
      let subscriptionId = extractStripeId(session.subscription);
      const customerEmailRaw =
        session.customer_details?.email || session.customer_email || null;
      const customerEmail = customerEmailRaw?.trim().toLowerCase() || null;

      console.log("[stripe-webhook] STEP 1 incoming checkout payload", {
        eventType: event.type,
        eventId: event.id,
        sessionId: session.id,
        mode: session.mode,
        paymentStatus: session.payment_status,
        payload: session,
      });

      console.log("[stripe-webhook] checkout.session.completed", {
        sessionId: session.id,
        mode: session.mode,
        payment_status: session.payment_status,
        metadata: session.metadata,
        customerId,
        subscriptionId,
        customerEmail,
      });

      if (session.mode !== "subscription") {
        console.warn("[stripe-webhook] skipping non-subscription checkout", session.id);
        return NextResponse.json({ received: true, skipped: "not_subscription" });
      }

      // Some subscription checkouts can complete before payment_status reaches "paid".
      // We still resolve the user + persist customer/subscription identifiers here.
      if (!subscriptionId && customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: "all",
        });
        subscriptionId = subs.data[0]?.id ?? null;
        console.log("[stripe-webhook] STEP 2 subscription fallback result", {
          customerId,
          subscriptionCount: subs.data.length,
          extractedSubscriptionId: subscriptionId,
        });
      }

      // Match row by email first (requested), then by stripe_customer_id.
      let matchedUserId: string | null = null;
      let matchedBy: "stripe_customer_id" | "email" | "resolver" | null = null;
      let matchedRow: { id: string; email: string | null } | null = null;

      if (customerEmail) {
        const { data: byEmail, error: byEmailError } = await supabase
          .from("users")
          .select("id, email")
          .ilike("email", customerEmail)
          .maybeSingle();

        console.log("[stripe-webhook] STEP 3 Supabase select by email", {
          email: customerEmail,
          data: byEmail,
          error: byEmailError,
        });

        if (byEmailError) {
          console.error("[stripe-webhook] error matching by email", byEmailError);
        } else if (byEmail?.id) {
          matchedUserId = byEmail.id;
          matchedBy = "email";
          matchedRow = { id: byEmail.id, email: byEmail.email ?? null };
        }
      }

      if (!matchedUserId && customerId) {
        const { data: byCustomer, error: byCustomerError } = await supabase
          .from("users")
          .select("id, email")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        console.log("[stripe-webhook] STEP 4 Supabase select by stripe_customer_id", {
          customerId,
          data: byCustomer,
          error: byCustomerError,
        });

        if (byCustomerError) {
          console.error("[stripe-webhook] error matching by stripe_customer_id", byCustomerError);
        } else if (byCustomer?.id) {
          matchedUserId = byCustomer.id;
          matchedBy = "stripe_customer_id";
          matchedRow = { id: byCustomer.id, email: byCustomer.email ?? null };
        }
      }

      // Final fallback to existing resolver path for metadata-based recovery.
      if (!matchedUserId) {
        const resolved = await resolveUserIdFromCheckoutSession(stripe, supabase, session);
        console.log("[stripe-webhook] STEP 5 resolver fallback result", resolved);
        if (resolved.userId) {
          matchedUserId = resolved.userId;
          matchedBy = "resolver";
          customerId = resolved.customerId || customerId;
          subscriptionId = resolved.subscriptionId || subscriptionId;
        }
      }

      console.log("[stripe-webhook] matched user", {
        sessionId: session.id,
        matchedUserId,
        matchedBy,
        extractedEmail: customerEmail,
        extractedSubscriptionId: subscriptionId,
        extractedCustomerId: customerId,
        matchedRow,
      });

      if (!matchedUserId) {
        console.error(
          "[stripe-webhook] FAILED: could not resolve public.users row for checkout",
          session.id,
          {
            customerId,
            subscriptionId,
            customerEmail,
          },
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

      // Final fallback: if we still don't have subscription id but user is matched,
      // recover it from Stripe by customer or by user-linked customer record.
      if (!subscriptionId && customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
          status: "all",
        });
        subscriptionId = subs.data[0]?.id ?? null;
        console.log("[stripe-webhook] STEP 6 second subscription fallback result", {
          customerId,
          subscriptionCount: subs.data.length,
          extractedSubscriptionId: subscriptionId,
        });
      }

      let updateData: unknown = null;
      let updateError: { message: string } | null = null;

      // First try explicit update by email as requested.
      if (customerEmail) {
        const { data, error } = await supabase
          .from("users")
          .update({
            is_pro: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .ilike("email", customerEmail)
          .select();

        console.log("[stripe-webhook] STEP 7 Supabase update by email result", {
          email: customerEmail,
          data,
          error,
        });

        if (error) {
          updateError = { message: error.message };
        } else if (Array.isArray(data) && data.length > 0) {
          updateData = data;
          updateError = null;
        }
      }

      // Fallback update by matched user id.
      if (!updateData) {
        const { data, error } = await upsertProForUser(supabase, {
          userId: matchedUserId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });

        console.log("[stripe-webhook] STEP 8 Supabase update by user result", {
          userId: matchedUserId,
          data,
          error,
        });

        if (error) {
          updateError = error;
        } else {
          updateData = data;
          updateError = null;
        }
      }

      if (updateError) {
        console.error("[stripe-webhook] FAILED: Supabase upsert Pro", {
          error: updateError,
          matchedUserId,
          customerId,
          subscriptionId,
          customerEmail,
        });
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      console.log("[stripe-webhook] SUCCESS: user upgraded to Pro", {
        eventType: event.type,
        userId: matchedUserId,
        resolution: matchedBy,
        customerId,
        subscriptionId,
        customerEmail,
        rows: updateData,
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
