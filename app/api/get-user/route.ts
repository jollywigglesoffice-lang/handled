import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { syncPublicUserFromAuth } from "@/lib/sync-public-user";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId", isPro: false }, { status: 400 });
    }

    const { error: syncError } = await syncPublicUserFromAuth(userId);
    if (syncError) {
      console.error("get-user: syncPublicUserFromAuth failed", syncError);
    }

    const { data, error } = await supabase
      .from("users")
      .select("is_pro, stripe_customer_id, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("get-user error", error);
      return NextResponse.json({ error: error.message, isPro: false }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({
        isPro: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      });
    }

    return NextResponse.json({
      isPro: Boolean(data.is_pro),
      stripeCustomerId: data.stripe_customer_id || null,
      stripeSubscriptionId: data.stripe_subscription_id || null,
    });
  } catch (error) {
    console.error("get-user route error", error);
    return NextResponse.json({ error: "Server error", isPro: false }, { status: 500 });
  }
}
