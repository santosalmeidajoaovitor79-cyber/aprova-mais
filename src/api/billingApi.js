async function buildInvokeError(error, functionName) {
  let message = error?.message || `Falha ao chamar ${functionName}.`;
  let details = null;

  if (error?.context) {
    try {
      const cloned = error.context.clone();
      const json = await cloned.json();
      details = json?.details ?? null;
      if (typeof json?.error === "string" && json.error.trim()) {
        message = json.error.trim();
      }
    } catch {
      try {
        const text = await error.context.text();
        if (typeof text === "string" && text.trim()) {
          message = text.trim();
        }
      } catch {
        // ignore parse failure and keep original message
      }
    }
  }

  const wrapped = new Error(message);
  wrapped.cause = error;
  wrapped.details = details;
  wrapped.functionName = functionName;
  return wrapped;
}

async function invokeBillingFunction(supabase, functionName, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  console.info(`[billing] invoking ${functionName}`, {
    hasSession: Boolean(session?.access_token),
    payloadKeys: body ? Object.keys(body) : [],
  });

  const result = await supabase.functions.invoke(functionName, {
    body,
    headers,
  });

  if (result.error) {
    throw await buildInvokeError(result.error, functionName);
  }

  return result;
}

export async function fetchOwnSubscription(supabase, userId) {
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

export async function createCheckoutSession(supabase, payload) {
  return invokeBillingFunction(supabase, "create-checkout-session", payload);
}

export async function createPortalSession(supabase, payload) {
  return invokeBillingFunction(supabase, "create-portal-session", payload);
}
