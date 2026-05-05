import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY." }, { status: 500 });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL." }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
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
      success_url: `${appUrl}/settings?upgraded=true`,
      cancel_url: `${appUrl}/settings?canceled=true`,
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
