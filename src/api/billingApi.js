import {
  supabase,
  SUPABASE_PUBLIC_ANON_KEY,
  SUPABASE_PUBLIC_URL,
} from "../lib/supabaseClient.js";

function parseFunctionsJsonResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function devBillingLog(label, payload) {
  if (import.meta.env.DEV) {
    console.info(`[Aprova][billing] ${label}`, payload);
  }
}

/**
 * Chama Edge Function de billing via fetch com Authorization (JWT) + apikey (anon).
 * Usa sempre o `supabase` singleton de supabaseClient.js (mesma instância do login).
 */
async function invokeBillingFunction(functionName, body, { accessToken: accessTokenOverride } = {}) {
  const supabaseUrl = SUPABASE_PUBLIC_URL;
  const anonKey = SUPABASE_PUBLIC_ANON_KEY;

  let accessToken = accessTokenOverride ?? null;
  if (!accessToken) {
    const { data, error: sessionReadError } = await supabase.auth.getSession();
    if (import.meta.env.DEV) {
      console.log("[Aprova][billing] session", data?.session ?? null);
    }
    if (sessionReadError) {
      console.warn("[Aprova][billing] getSession error", sessionReadError.message);
    }
    accessToken = data?.session?.access_token ?? null;
  }

  if (!accessToken) {
    throw new Error("Faça login para continuar.");
  }

  if (!supabaseUrl || !anonKey) {
    throw new Error("Configuração do Supabase ausente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }

  if (import.meta.env.DEV) {
    let userId = null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser(accessToken);
      userId = user?.id ?? null;
    } catch {
      userId = "(getUser falhou — só log)";
    }
    let fnHost = supabaseUrl;
    try {
      fnHost = new URL(supabaseUrl.startsWith("http") ? supabaseUrl : `https://${supabaseUrl}`).host;
    } catch {
      /* ignore */
    }
    devBillingLog(`invoke → ${functionName}`, {
      functionsHost: fnHost,
      hasSession: Boolean(accessToken),
      userId,
      tokenTail: accessToken.length > 10 ? `…${accessToken.slice(-8)}` : "(curto)",
    });
  }

  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  const parsed = parseFunctionsJsonResponse(text);

  if (!res.ok) {
    let message = `Não foi possível concluir a operação (${res.status}).`;
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
      message = parsed.error.trim();
    } else if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
      message = parsed.message.trim();
    } else if (text?.trim()) {
      message = text.trim();
    }
    const wrapped = new Error(message);
    wrapped.status = res.status;
    wrapped.details = parsed?.details;
    wrapped.code = parsed?.code;
    throw wrapped;
  }

  return { data: parsed, error: null };
}

export async function fetchOwnSubscription(userId) {
  if (!userId) {
    return { data: null, error: new Error("AUTH_REQUIRED") };
  }

  return supabase
    .from("subscriptions")
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, billing_cycle, status, current_period_end, cancel_at_period_end, created_at, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();
}

export async function createCheckoutSession(payload, invokeOptions) {
  return invokeBillingFunction("create-checkout-session", payload, invokeOptions);
}

export async function createPortalSession(payload, invokeOptions) {
  return invokeBillingFunction("create-portal-session", payload, invokeOptions);
}
