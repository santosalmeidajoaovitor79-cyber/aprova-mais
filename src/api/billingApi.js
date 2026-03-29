async function invokeBillingFunction(supabase, functionName, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return supabase.functions.invoke(functionName, {
    body,
    headers,
  });
}

export async function fetchOwnSubscription(supabase) {
  return supabase
    .from("subscriptions")
    .select(
      "id, user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_key, billing_cycle, status, current_period_end, cancel_at_period_end, created_at, updated_at"
    )
    .maybeSingle();
}

export async function createCheckoutSession(supabase, payload) {
  return invokeBillingFunction(supabase, "create-checkout-session", payload);
}

export async function createPortalSession(supabase, payload) {
  return invokeBillingFunction(supabase, "create-portal-session", payload);
}
