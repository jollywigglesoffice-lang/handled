import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (!secret) {
    return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  }
  if (!appUrl) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 500 });
  }

  let body: { userId?: unknown; email?: unknown };
  try {
    body = (await req.json()) as { userId?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!userId || !email) {
    return NextResponse.json({ error: "Missing userId or email" }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  if (!authClient) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();
  if (authError || !user?.id || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.id !== userId || user.email !== email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const stripe = new Stripe(secret, {
      apiVersion: "2026-04-22.dahlia",
    });

    const { data: row } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = row?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const list = await stripe.customers.list({ email, limit: 1 });
      customerId = list.data[0]?.id ?? null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { userId },
        });
        customerId = customer.id;
      }
      const { error: saveError } = await supabase.from("users").upsert(
        { id: userId, stripe_customer_id: customerId },
        { onConflict: "id" },
      );
      if (saveError) {
        console.error("checkout save customer", saveError);
        return NextResponse.json({ error: saveError.message }, { status: 500 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      metadata: {
        userId,
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Handled Pro",
              description: "Unlimited AI email replies",
            },
            unit_amount: 900,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings?upgraded=true`,
      cancel_url: `${appUrl}/settings?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("create checkout session error", error);
    return NextResponse.json(
      { error: "Could not create checkout session" },
      { status: 500 },
    );
  }
}
