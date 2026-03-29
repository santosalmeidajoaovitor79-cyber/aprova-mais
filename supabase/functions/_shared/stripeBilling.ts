import Stripe from "npm:stripe";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { jsonResponse } from "./edgeAuth.ts";

export const BILLING_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export const STRIPE_PRICE_MAP = {
  price_1TGG1XBBsAS1lAp1UGeMhyj0: { planKey: "inicial", billingCycle: "monthly" },
  price_1TGGHuBBsAS1lAp14HcpcTHS: { planKey: "inicial", billingCycle: "yearly" },
  price_1TGG3CBBsAS1lAp12hzsTwcu: { planKey: "pro", billingCycle: "monthly" },
  price_1TGGGtBBsAS1lAp1j6wF62D9: { planKey: "pro", billingCycle: "yearly" },
} as const;

export type BillingPlanKey = "inicial" | "pro";
export type BillingCycle = "monthly" | "yearly";

type StripePriceMapKey = keyof typeof STRIPE_PRICE_MAP;

export function billingError(message: string, code: string, status = 400, details?: Record<string, unknown>) {
  return jsonResponse(
    BILLING_CORS_HEADERS,
    {
      error: message,
      code,
      details: details ?? {},
    },
    status
  );
}

export function assertBillingEnv(requiredKeys: string[], logContext: string): Response | null {
  const missing = requiredKeys.filter((key) => !Deno.env.get(key));
  if (!missing.length) return null;
  console.error(`[${logContext}] Variaveis de ambiente ausentes`, { missing });
  return billingError("Variáveis de billing não configuradas.", "BILLING_ENV_MISSING", 500, {
    missingEnv: missing,
  });
}

export function createStripeClient() {
  return new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    appInfo: {
      name: "Aprova+",
    },
  });
}

export function createSupabaseAdminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export function mapPriceToPlan(priceId: string | null | undefined): {
  planKey: BillingPlanKey | null;
  billingCycle: BillingCycle | null;
} {
  if (!priceId) return { planKey: null, billingCycle: null };
  const mapped = STRIPE_PRICE_MAP[priceId as StripePriceMapKey];
  if (!mapped) return { planKey: null, billingCycle: null };
  return mapped;
}

export function isSupportedPriceId(priceId: string | null | undefined) {
  if (!priceId) return false;
  return Boolean(STRIPE_PRICE_MAP[priceId as StripePriceMapKey]);
}

export async function getSubscriptionByUserId(supabaseAdmin: SupabaseClient, userId: string) {
  return supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, billing_cycle, status, current_period_end, cancel_at_period_end"
    )
    .eq("user_id", userId)
    .maybeSingle();
}

export async function getSubscriptionByStripeSubscriptionId(
  supabaseAdmin: SupabaseClient,
  stripeSubscriptionId: string
) {
  return supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, billing_cycle, status, current_period_end, cancel_at_period_end"
    )
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
}

export async function getUserProfile(supabaseAdmin: SupabaseClient, userId: string) {
  return supabaseAdmin.from("profiles").select("id, email, name").eq("id", userId).maybeSingle();
}

export async function upsertSubscriptionSnapshot(
  supabaseAdmin: SupabaseClient,
  payload: {
    user_id: string;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_price_id?: string | null;
    plan_key?: string | null;
    billing_cycle?: string | null;
    status?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
  }
) {
  return supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        user_id: payload.user_id,
        stripe_customer_id: payload.stripe_customer_id ?? null,
        stripe_subscription_id: payload.stripe_subscription_id ?? null,
        stripe_price_id: payload.stripe_price_id ?? null,
        plan_key: payload.plan_key ?? null,
        billing_cycle: payload.billing_cycle ?? null,
        status: payload.status ?? "inactive",
        current_period_end: payload.current_period_end ?? null,
        cancel_at_period_end: payload.cancel_at_period_end ?? false,
      },
      { onConflict: "user_id" }
    )
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, billing_cycle, status, current_period_end, cancel_at_period_end"
    )
    .maybeSingle();
}

export async function findOrCreateStripeCustomer(params: {
  stripe: Stripe;
  supabaseAdmin: SupabaseClient;
  userId: string;
  email: string;
  name?: string | null;
}) {
  const { stripe, supabaseAdmin, userId, email, name } = params;
  const existing = await getSubscriptionByUserId(supabaseAdmin, userId);
  if (existing.error) throw existing.error;
  if (existing.data?.stripe_customer_id) {
    return {
      customerId: existing.data.stripe_customer_id,
      subscriptionRow: existing.data,
    };
  }

  const customer = await stripe.customers.create({
    email,
    name: name?.trim() || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const saved = await upsertSubscriptionSnapshot(supabaseAdmin, {
    user_id: userId,
    stripe_customer_id: customer.id,
    status: "checkout_pending",
  });
  if (saved.error) throw saved.error;

  return {
    customerId: customer.id,
    subscriptionRow: saved.data,
  };
}

export function toIsoFromUnix(value: number | null | undefined) {
  if (!value) return null;
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

export function extractSubscriptionItemPriceId(subscription: Stripe.Subscription | null | undefined) {
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  return typeof priceId === "string" ? priceId : null;
}

export function normalizeStripeSubscriptionStatus(status: string | null | undefined) {
  const safe = String(status ?? "").trim();
  if (
    [
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ].includes(safe)
  ) {
    return safe;
  }
  return "inactive";
}
