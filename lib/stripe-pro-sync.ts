import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize Stripe API refs that may be a string id or an expanded object. */
export function extractStripeId(
  ref: string | { id?: string } | null | undefined,
): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && typeof (ref as { id?: string }).id === "string") {
    return (ref as { id: string }).id;
  }
  return null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const t = email?.trim().toLowerCase();
  return t || null;
}

export type ResolveUserResult = {
  userId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  resolution: string;
};

/**
 * Resolve the public.users row (Auth user id) for a completed Checkout Session.
 */
export async function resolveUserIdFromCheckoutSession(
  stripe: Stripe,
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<ResolveUserResult> {
  let customerId = extractStripeId(session.customer);
  let subscriptionId = extractStripeId(session.subscription);

  const metaUserId = session.metadata?.userId?.trim() || null;
  if (metaUserId) {
    return {
      userId: metaUserId,
      customerId,
      subscriptionId,
      resolution: "session.metadata.userId",
    };
  }

  if ((!customerId || !subscriptionId) && session.id) {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["subscription", "customer"],
    });
    customerId = extractStripeId(full.customer);
    subscriptionId = extractStripeId(full.subscription);
    const expandedMeta = full.metadata?.userId?.trim();
    if (expandedMeta) {
      return {
        userId: expandedMeta,
        customerId,
        subscriptionId,
        resolution: "session.retrieve.metadata.userId",
      };
    }
  }

  if (customerId) {
    const { data: byCustomer } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (byCustomer?.id) {
      return {
        userId: byCustomer.id,
        customerId,
        subscriptionId,
        resolution: "users.stripe_customer_id",
      };
    }
  }

  let email = normalizeEmail(
    session.customer_details?.email || session.customer_email || undefined,
  );

  if (!email && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (typeof customer !== "string" && !customer.deleted) {
      email = normalizeEmail(customer.email);
      const cidMeta = customer.metadata?.userId?.trim();
      if (cidMeta) {
        return {
          userId: cidMeta,
          customerId,
          subscriptionId,
          resolution: "stripe_customer.metadata.userId",
        };
      }
    }
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      return {
        userId: byEmail.id,
        customerId,
        subscriptionId,
        resolution: "users.email",
      };
    }
  }

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const subMeta = sub.metadata?.userId?.trim();
    if (subMeta) {
      return {
        userId: subMeta,
        customerId: customerId || extractStripeId(sub.customer),
        subscriptionId,
        resolution: "subscription.metadata.userId",
      };
    }
  }

  return {
    userId: null,
    customerId,
    subscriptionId,
    resolution: "unresolved",
  };
}

export async function upsertProForUser(
  supabase: SupabaseClient,
  params: {
    userId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  },
): Promise<{ data: unknown; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        id: params.userId,
        is_pro: true,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
      },
      { onConflict: "id" },
    )
    .select();

  return { data, error };
}
