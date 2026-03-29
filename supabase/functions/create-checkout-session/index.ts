import { resolveAuthenticatedUser } from "../_shared/edgeAuth.ts";
import {
  assertBillingEnv,
  BILLING_CORS_HEADERS,
  billingError,
  createStripeClient,
  createSupabaseAdminClient,
  findOrCreateStripeCustomer,
  isSupportedPriceId,
  mapPriceToPlan,
  upsertSubscriptionSnapshot,
} from "../_shared/stripeBilling.ts";

const LOG_CTX = "create-checkout-session";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: BILLING_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return billingError("Método não permitido.", "METHOD_NOT_ALLOWED", 405);
  }

  try {
    const envError = assertBillingEnv(
      ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"],
      LOG_CTX
    );
    if (envError) return envError;

    const authResult = await resolveAuthenticatedUser(req, BILLING_CORS_HEADERS, LOG_CTX);
    if ("response" in authResult) return authResult.response;

    const stripe = createStripeClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await req.json().catch(() => ({}));

    const priceId = typeof body?.priceId === "string" ? body.priceId.trim() : "";
    const successUrl = typeof body?.successUrl === "string" ? body.successUrl.trim() : "";
    const cancelUrl = typeof body?.cancelUrl === "string" ? body.cancelUrl.trim() : "";

    if (!priceId || !successUrl || !cancelUrl) {
      return billingError("priceId, successUrl e cancelUrl são obrigatórios.", "BILLING_VALIDATION_ERROR", 400);
    }

    if (!isSupportedPriceId(priceId)) {
      return billingError("Esse priceId não está liberado para o billing do Aprova+.", "BILLING_PRICE_NOT_ALLOWED", 400, {
        priceId,
      });
    }

    const profileResult = await supabaseAdmin
      .from("profiles")
      .select("id, email, name")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (profileResult.error) {
      console.error(`[${LOG_CTX}] erro ao carregar profile`, profileResult.error);
      return billingError("Não consegui carregar o perfil do usuário.", "PROFILE_FETCH_ERROR", 500);
    }

    const profileEmail = profileResult.data?.email?.trim() || authResult.user.email?.trim() || "";
    if (!profileEmail) {
      return billingError("Seu usuário precisa ter e-mail para iniciar a assinatura.", "BILLING_EMAIL_REQUIRED", 400);
    }

    const { customerId } = await findOrCreateStripeCustomer({
      stripe,
      supabaseAdmin,
      userId: authResult.user.id,
      email: profileEmail,
      name: profileResult.data?.name ?? authResult.user.user_metadata?.name ?? null,
    });

    const mapped = mapPriceToPlan(priceId);

    await upsertSubscriptionSnapshot(supabaseAdmin, {
      user_id: authResult.user.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      plan_key: mapped.planKey,
      billing_cycle: mapped.billingCycle,
      status: "checkout_pending",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: authResult.user.id,
      customer_update: {
        address: "auto",
        name: "auto",
      },
      metadata: {
        supabase_user_id: authResult.user.id,
        selected_price_id: priceId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: authResult.user.id,
          selected_price_id: priceId,
        },
      },
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        status: 200,
        headers: BILLING_CORS_HEADERS,
      }
    );
  } catch (error) {
    console.error(`[${LOG_CTX}] erro inesperado`, error);
    return billingError("Não consegui iniciar o checkout Stripe agora.", "CHECKOUT_SESSION_CREATE_FAILED", 500);
  }
});
