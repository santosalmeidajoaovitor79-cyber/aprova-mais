import Stripe from "npm:stripe";
import {
  assertBillingEnv,
  BILLING_CORS_HEADERS,
  billingError,
  createStripeClient,
  createSupabaseAdminClient,
  extractSubscriptionItemPriceId,
  formatStripeOrUnknownError,
  getSubscriptionByStripeSubscriptionId,
  mapPriceToPlan,
  normalizeStripeSubscriptionStatus,
  toIsoFromUnix,
  upsertSubscriptionSnapshot,
} from "../_shared/stripeBilling.ts";

const LOG_CTX = "stripe-webhook";

async function resolveCustomerMetadataUserId(stripe: Stripe, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const metadataUserId = customer.metadata?.supabase_user_id;
  return typeof metadataUserId === "string" && metadataUserId.trim() ? metadataUserId.trim() : null;
}

async function syncStripeSubscription(
  stripe: Stripe,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  subscription: Stripe.Subscription
) {
  const priceId = extractSubscriptionItemPriceId(subscription);
  const mapped = mapPriceToPlan(priceId);

  if (!mapped.planKey || !mapped.billingCycle) {
    throw new Error(`Price da Stripe sem mapeamento de plano: ${priceId ?? "desconhecido"}.`);
  }

  const existingBySubscriptionId = await getSubscriptionByStripeSubscriptionId(supabaseAdmin, subscription.id);
  if (existingBySubscriptionId.error) throw existingBySubscriptionId.error;

  let userId = existingBySubscriptionId.data?.user_id ?? null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  if (!userId && customerId) {
    userId = await resolveCustomerMetadataUserId(stripe, customerId);
  }

  const metadataUserId = subscription.metadata?.supabase_user_id;
  if (!userId && typeof metadataUserId === "string" && metadataUserId.trim()) {
    userId = metadataUserId.trim();
  }

  if (!userId) {
    throw new Error(`Nao foi possivel resolver o user_id para a assinatura ${subscription.id}.`);
  }

  const result = await upsertSubscriptionSnapshot(supabaseAdmin, {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_key: mapped.planKey,
    billing_cycle: mapped.billingCycle,
    status: normalizeStripeSubscriptionStatus(subscription.status),
    current_period_end: toIsoFromUnix(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  });

  if (result.error) throw result.error;
  return result.data;
}

async function syncCheckoutCompleted(
  stripe: Stripe,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  session: Stripe.Checkout.Session
) {
  const userId = typeof session.client_reference_id === "string" ? session.client_reference_id.trim() : "";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const priceId = session.metadata?.selected_price_id ?? null;
  const mapped = mapPriceToPlan(priceId);

  if (priceId && (!mapped.planKey || !mapped.billingCycle)) {
    throw new Error(`Checkout concluido com price sem mapeamento: ${priceId}.`);
  }

  if (userId) {
    const pending = await upsertSubscriptionSnapshot(supabaseAdmin, {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      plan_key: mapped.planKey,
      billing_cycle: mapped.billingCycle,
      status: "checkout_pending",
    });
    if (pending.error) throw pending.error;
  }

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(stripe, supabaseAdmin, subscription);
  }
}

async function syncInvoiceSubscription(
  stripe: Stripe,
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  invoice: Stripe.Invoice
) {
  const subscriptionId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(stripe, supabaseAdmin, subscription);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: BILLING_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return billingError("Método não permitido.", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const envError = assertBillingEnv(
      ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      LOG_CTX
    );
    if (envError) return envError;

    const stripe = createStripeClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return billingError("Header stripe-signature ausente.", "STRIPE_SIGNATURE_MISSING", 400);
    }

    const rawBody = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );

    console.log(`[${LOG_CTX}] evento recebido`, { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await syncCheckoutCompleted(stripe, supabaseAdmin, session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(stripe, supabaseAdmin, subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceSubscription(stripe, supabaseAdmin, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await syncInvoiceSubscription(stripe, supabaseAdmin, invoice);
        break;
      }

      default:
        console.log(`[${LOG_CTX}] evento ignorado`, { type: event.type });
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: BILLING_CORS_HEADERS,
    });
  } catch (error) {
    console.error(`[${LOG_CTX}] erro no webhook`, error);
    return billingError("Falha ao processar webhook Stripe.", "STRIPE_WEBHOOK_FAILED", 500, {
      message: formatStripeOrUnknownError(error),
    });
  }
});
