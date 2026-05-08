import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    console.error("Stripe webhook missing signature");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Missing webhook secret" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  console.log("Stripe webhook received:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.userId;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      console.log("Checkout completed:", {
        sessionId: session.id,
        userId,
        customerId,
        subscriptionId,
      });

      if (!userId) {
        console.error("Missing userId metadata on checkout session:", session.id);
        return NextResponse.json(
          { error: "Missing userId metadata" },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from("users")
        .upsert(
          {
            id: userId,
            is_pro: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          },
          { onConflict: "id" }
        )
        .select();

      if (error) {
        console.error("Supabase Pro update failed:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      console.log("User upgraded to Pro in Supabase:", data);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      const userId = subscription.metadata?.userId;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;

      console.log("Subscription deleted:", {
        userId,
        customerId,
      });

      if (userId) {
        await supabase.from("users").update({ is_pro: false }).eq("id", userId);
      } else if (customerId) {
        await supabase
          .from("users")
          .update({ is_pro: false })
          .eq("stripe_customer_id", customerId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook handler failed:", error);
    return NextResponse.json(
      { error: error?.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
