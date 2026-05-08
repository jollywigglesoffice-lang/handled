import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  let body: { userId?: unknown; email?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!userId || !email) {
    return NextResponse.json({ error: "Missing userId or email." }, { status: 400 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    let customerId: string | undefined;

    const { data: existingUser } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    customerId = existingUser?.stripe_customer_id || undefined;

    if (!customerId) {
      const customers = await stripe.customers.list({
        email,
        limit: 1,
      });

      customerId = customers.data[0]?.id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { userId },
        });
        customerId = customer.id;
      }

      await supabase.from("users").upsert({
        id: userId,
        stripe_customer_id: customerId,
      });
    }

    console.log("Stripe checkout origin:", origin);
    console.log("Stripe success_url:", `${origin}/success?upgraded=true`);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Handled Pro",
              description: "Unlimited AI email replies",
            },
            unit_amount: 900,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      success_url: `${origin}/success?upgraded=true`,
      cancel_url: `${origin}/settings?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("create checkout session error", error);

    const message =
      error instanceof Error
        ? error.message
        : "Could not create checkout session. Check Stripe configuration.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
