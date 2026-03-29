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

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isAllowedClientRedirectUrl(value: string, requestOrigin: string | null) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    if (!requestOrigin) return true;
    return parsed.origin === requestOrigin;
  } catch {
    return false;
  }
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
      ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY"],
      LOG_CTX
    );
    if (envError) return envError;

    const authResult = await resolveAuthenticatedUser(req, BILLING_CORS_HEADERS, LOG_CTX);
    if ("response" in authResult) return authResult.response;

    const stripe = createStripeClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const body = await req.json().catch(() => ({}));
    const requestOrigin = req.headers.get("origin");

    const priceId = typeof body?.priceId === "string" ? body.priceId.trim() : "";
    const successUrl = typeof body?.successUrl === "string" ? body.successUrl.trim() : "";
    const cancelUrl = typeof body?.cancelUrl === "string" ? body.cancelUrl.trim() : "";

    console.log(`[${LOG_CTX}] payload recebido`, {
      userId: authResult.user.id,
      priceId,
      successUrlPresent: Boolean(successUrl),
      cancelUrlPresent: Boolean(cancelUrl),
    });

    if (!priceId || !successUrl || !cancelUrl) {
      return billingError("priceId, successUrl e cancelUrl são obrigatórios.", "BILLING_VALIDATION_ERROR", 400);
    }

    if (!isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
      return billingError(
        "As URLs de sucesso e cancelamento precisam ser válidas.",
        "BILLING_URL_INVALID",
        400,
        { successUrl, cancelUrl }
      );
    }

    if (
      !isAllowedClientRedirectUrl(successUrl, requestOrigin) ||
      !isAllowedClientRedirectUrl(cancelUrl, requestOrigin)
    ) {
      return billingError(
        "As URLs de billing precisam voltar para a mesma origem do app.",
        "BILLING_URL_ORIGIN_NOT_ALLOWED",
        400,
        { successUrl, cancelUrl, requestOrigin }
      );
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

    if (!profileResult.data?.id) {
      return billingError(
        "Seu perfil ainda não está pronto para iniciar a assinatura. Atualize a página e tente novamente.",
        "PROFILE_NOT_FOUND",
        409,
        { userId: authResult.user.id }
      );
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
    console.log(`[${LOG_CTX}] price mapeado`, { priceId, mapped });

    const snapshotResult = await upsertSubscriptionSnapshot(supabaseAdmin, {
      user_id: authResult.user.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      plan_key: mapped.planKey,
      billing_cycle: mapped.billingCycle,
      status: "checkout_pending",
    });
    if (snapshotResult.error) {
      console.error(`[${LOG_CTX}] erro ao salvar snapshot checkout_pending`, snapshotResult.error);
      return billingError(
        "Não consegui preparar sua assinatura para o checkout.",
        "SUBSCRIPTION_SNAPSHOT_FAILED",
        500,
        { message: snapshotResult.error.message }
      );
    }

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

    console.log(`[${LOG_CTX}] checkout session criada`, {
      userId: authResult.user.id,
      stripeCustomerId: customerId,
      sessionId: session.id,
      hasUrl: Boolean(session.url),
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
    return billingError("Não consegui iniciar o checkout Stripe agora.", "CHECKOUT_SESSION_CREATE_FAILED", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
