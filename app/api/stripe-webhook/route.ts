import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !whSecret) {
    return NextResponse.json({ error: "Missing Stripe env" }, { status: 500 });
  }

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(secret, {
    apiVersion: "2026-04-22.dahlia",
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId?.trim();
    const rawCustomer = session.customer;
    const customerId =
      typeof rawCustomer === "string"
        ? rawCustomer
        : rawCustomer &&
            typeof rawCustomer === "object" &&
            "id" in rawCustomer &&
            !("deleted" in rawCustomer && (rawCustomer as { deleted?: boolean }).deleted)
          ? (rawCustomer as Stripe.Customer).id
          : undefined;

    if (userId) {
      const update: { is_pro: boolean; stripe_customer_id?: string } = {
        is_pro: true,
      };
      if (customerId) {
        update.stripe_customer_id = customerId;
      }
      const { error } = await supabase.from("users").update(update).eq("id", userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
