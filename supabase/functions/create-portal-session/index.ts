import { resolveAuthenticatedUser } from "../_shared/edgeAuth.ts";
import {
  assertBillingEnv,
  BILLING_CORS_HEADERS,
  billingError,
  createStripeClient,
  createSupabaseAdminClient,
  getSubscriptionByUserId,
} from "../_shared/stripeBilling.ts";

const LOG_CTX = "create-portal-session";

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

    const supabaseAdmin = createSupabaseAdminClient();
    const stripe = createStripeClient();
    const body = await req.json().catch(() => ({}));
    const returnUrl = typeof body?.returnUrl === "string" ? body.returnUrl.trim() : "";

    if (!returnUrl) {
      return billingError("returnUrl é obrigatório para abrir o portal.", "BILLING_RETURN_URL_REQUIRED", 400);
    }

    const existing = await getSubscriptionByUserId(supabaseAdmin, authResult.user.id);
    if (existing.error) {
      console.error(`[${LOG_CTX}] erro ao buscar assinatura`, existing.error);
      return billingError("Não consegui localizar a assinatura do usuário.", "SUBSCRIPTION_FETCH_ERROR", 500);
    }

    if (!existing.data?.stripe_customer_id) {
      return billingError(
        "Ainda não existe um customer Stripe associado a este usuário.",
        "STRIPE_CUSTOMER_NOT_FOUND",
        400
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: existing.data.stripe_customer_id,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: BILLING_CORS_HEADERS,
    });
  } catch (error) {
    console.error(`[${LOG_CTX}] erro inesperado`, error);
    return billingError("Não consegui abrir o portal de assinatura agora.", "PORTAL_SESSION_CREATE_FAILED", 500);
  }
});
