import { useCallback, useEffect, useMemo, useState } from "react";
import * as billingApi from "../api/billingApi.js";
import {
  buildSubscriptionAccess,
  getCurrentPlanBadge,
  getRenewalLabel,
  getStatusLabel,
} from "../lib/billing.js";
import { ensureValidSession } from "../lib/ensureValidSession.js";
import { supabase } from "../lib/supabaseClient.js";
import { useCheckout } from "./useCheckout.js";

function buildDefaultState() {
  return {
    subscription: null,
    loading: false,
    portalBusy: false,
    error: "",
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} _supabase mesmo singleton de supabaseClient (mantido para compatibilidade com App). */
export function useSubscription(_supabase, session, options = {}) {
  const { onRequireAuth } = options;
  const checkout = useCheckout(options);
  const [state, setState] = useState(buildDefaultState);

  const refreshSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setState(buildDefaultState());
      return { data: null, error: null };
    }

    setState((prev) => ({ ...prev, loading: true, error: "" }));
    const { data, error } = await billingApi.fetchOwnSubscription(session.user.id);
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
  }, [session?.user?.id]);

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
    async (selection) => {
      checkout.clearCheckoutError();
      setState((prev) => ({ ...prev, error: "" }));
      console.info("[billing] startCheckout", selection);
      return checkout.startCheckout(selection);
    },
    [checkout.clearCheckoutError, checkout.startCheckout]
  );

  const openBillingPortal = useCallback(async () => {
    if (!session?.user?.id) {
      onRequireAuth?.();
      return { error: new Error("AUTH_REQUIRED") };
    }

    const syncAuthAfterPortalFailure = async (reason) => {
      if (reason === "invalid_after_refresh") return;
      onRequireAuth?.();
      await supabase.auth.signOut().catch(() => {});
    };

    setState((prev) => ({ ...prev, portalBusy: true, error: "" }));

    const portalFail = async (message, err) => {
      setState((prev) => ({ ...prev, portalBusy: false, error: message }));
      return { error: err || new Error(message) };
    };

    try {
      console.info("[billing] openBillingPortal");
      let ensured = await ensureValidSession();
      if (!ensured.ok) {
        const msg =
          ensured.reason === "project_mismatch"
            ? "O app está configurado para outro projeto Supabase que o da sua sessão. Confira VITE_SUPABASE_URL no .env."
            : "Faça login novamente para abrir o portal de assinatura.";
        await syncAuthAfterPortalFailure(ensured.reason);
        return portalFail(msg, ensured.error);
      }

      let accessToken = ensured.accessToken;
      let attempt = 0;

      while (attempt < 2) {
        try {
          const { data } = await billingApi.createPortalSession(
            {
              returnUrl: `${window.location.origin}${window.location.pathname || "/"}?tab=profile`,
            },
            { accessToken }
          );
          if (!data?.url) throw new Error("Portal sem URL retornada.");
          window.location.assign(data.url);
          return { error: null };
        } catch (error) {
          if (error?.status === 401 && attempt === 0) {
            const again = await ensureValidSession();
            if (again.ok) {
              accessToken = again.accessToken;
              attempt += 1;
              continue;
            }
            await syncAuthAfterPortalFailure(again.reason);
            const msg =
              again.reason === "project_mismatch"
                ? "O app está configurado para outro projeto Supabase que o da sua sessão. Confira o .env."
                : "Sessão inválida. Faça login novamente.";
            return portalFail(msg, error);
          }
          console.error("[billing] openBillingPortal failed", error);
          return portalFail(error.message || "Nao consegui abrir o portal de assinatura.", error);
        }
      }

      return portalFail("Nao consegui abrir o portal de assinatura.");
    } catch (error) {
      console.error("[billing] openBillingPortal failed", error);
      return portalFail(error.message || "Nao consegui abrir o portal de assinatura.", error);
    }
  }, [onRequireAuth, session?.user?.id]);

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
    checkoutBusy: checkout.checkoutBusy,
    portalBusy: state.portalBusy,
    error: state.error || checkout.checkoutError,
    refreshSubscription,
    startCheckout,
    openBillingPortal,
  };
}
