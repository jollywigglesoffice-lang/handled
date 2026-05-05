import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  } 

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    console.error("Webhook signature verification failed", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.metadata?.userId;
      const customerId = typeof session.customer === "string" ? session.customer : null;

      if (!userId) {
        console.error("checkout.session.completed missing userId metadata", session.id);
      } else {
        const { error } = await supabase
          .from("users")
          .update({
            is_pro: true,
            stripe_customer_id: customerId,
          })
          .eq("id", userId);

        if (error) {
          console.error("Failed to update user Pro status", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log("User upgraded to Pro", userId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    console.error("stripe webhook handler error", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
