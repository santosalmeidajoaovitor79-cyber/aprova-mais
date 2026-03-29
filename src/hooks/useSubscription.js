import { useCallback, useEffect, useMemo, useState } from "react";
import * as billingApi from "../api/billingApi.js";
import {
  buildSubscriptionAccess,
  getBillingPrice,
  getCurrentPlanBadge,
  getRenewalLabel,
  getStatusLabel,
} from "../lib/billing.js";

function buildDefaultState() {
  return {
    subscription: null,
    loading: false,
    checkoutBusy: false,
    portalBusy: false,
    error: "",
  };
}

export function useSubscription(supabase, session, options = {}) {
  const { onRequireAuth } = options;
  const [state, setState] = useState(buildDefaultState);

  const refreshSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setState(buildDefaultState());
      return { data: null, error: null };
    }

    setState((prev) => ({ ...prev, loading: true, error: "" }));
    const { data, error } = await billingApi.fetchOwnSubscription(supabase);
    if (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        subscription: null,
        error: error.message || "Nao consegui carregar sua assinatura.",
      }));
      return { data: null, error };
    }

    setState((prev) => ({
      ...prev,
      loading: false,
      subscription: data ?? null,
      error: "",
    }));
    return { data: data ?? null, error: null };
  }, [session?.user?.id, supabase]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const onFocus = () => {
      void refreshSubscription();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session?.user?.id, refreshSubscription]);

  const access = useMemo(() => buildSubscriptionAccess(state.subscription), [state.subscription]);

  const startCheckout = useCallback(
    async ({ planKey, billingCycle }) => {
      if (!session?.user?.id) {
        onRequireAuth?.();
        return { error: new Error("AUTH_REQUIRED") };
      }

      const price = getBillingPrice(planKey, billingCycle);
      if (!price?.priceId) {
        const error = new Error("Plano de billing inválido.");
        setState((prev) => ({ ...prev, error: error.message }));
        return { error };
      }

      setState((prev) => ({ ...prev, checkoutBusy: true, error: "" }));
      try {
        const origin = window.location.origin;
        const currentPath = window.location.pathname || "/";
        const successUrl = `${origin}${currentPath}?billing=success&tab=profile`;
        const cancelUrl = `${origin}${currentPath}?billing=cancel&tab=profile`;
        console.info("[billing] startCheckout", { planKey, billingCycle, currentPath });
        const { data } = await billingApi.createCheckoutSession(supabase, {
          priceId: price.priceId,
          successUrl,
          cancelUrl,
        });
        if (!data?.url) throw new Error("Checkout sem URL retornada.");
        window.location.assign(data.url);
        return { error: null };
      } catch (error) {
        console.error("[billing] startCheckout failed", error);
        setState((prev) => ({
          ...prev,
          checkoutBusy: false,
          error: error.message || "Nao consegui abrir o checkout.",
        }));
        return { error };
      }
    },
    [onRequireAuth, session?.user?.id, supabase]
  );

  const openBillingPortal = useCallback(async () => {
    if (!session?.user?.id) {
      onRequireAuth?.();
      return { error: new Error("AUTH_REQUIRED") };
    }

    setState((prev) => ({ ...prev, portalBusy: true, error: "" }));
    try {
      console.info("[billing] openBillingPortal");
      const { data } = await billingApi.createPortalSession(supabase, {
        returnUrl: `${window.location.origin}${window.location.pathname || "/"}`,
      });
      if (!data?.url) throw new Error("Portal sem URL retornada.");
      window.location.assign(data.url);
      return { error: null };
    } catch (error) {
      console.error("[billing] openBillingPortal failed", error);
      setState((prev) => ({
        ...prev,
        portalBusy: false,
        error: error.message || "Nao consegui abrir o portal de assinatura.",
      }));
      return { error };
    }
  }, [onRequireAuth, session?.user?.id, supabase]);

  const decorated = useMemo(() => {
    return {
      ...state.subscription,
      statusLabel: getStatusLabel(state.subscription?.status),
      renewalLabel: getRenewalLabel(state.subscription),
      currentPlanBadge: getCurrentPlanBadge(access),
    };
  }, [access, state.subscription]);

  return {
    subscription: decorated,
    rawSubscription: state.subscription,
    access,
    loading: state.loading,
    checkoutBusy: state.checkoutBusy,
    portalBusy: state.portalBusy,
    error: state.error,
    refreshSubscription,
    startCheckout,
    openBillingPortal,
  };
}
