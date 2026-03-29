import { useCallback, useMemo, useState } from "react";
import { getBillingPrice, PRICE_MAP } from "../lib/billing.js";
import { supabase, SUPABASE_PUBLIC_URL } from "../lib/supabaseClient.js";

// TEMP DEBUG — remover este bloco inteiro e restaurar billingApi + ensureValidSession quando o diagnóstico terminar.

/**
 * Checkout Stripe — modo diagnóstico (logs no console).
 * O botão "Assinar" em `BillingPanel` chama `onSelectPlan` → `useSubscription.startCheckout` → esta função.
 *
 * @param {{ onRequireAuth?: () => void }} [options]
 */
export function useCheckout(options = {}) {
  const { onRequireAuth } = options;
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const clearCheckoutError = useCallback(() => setCheckoutError(""), []);

  /**
   * @param {{ planKey: string, billingCycle: string } | { priceKey: keyof typeof PRICE_MAP } | { priceId: string }} input
   */
  const startCheckout = useCallback(
    async (input) => {
      let priceId = null;
      if (input && typeof input.priceId === "string" && input.priceId.trim()) {
        priceId = input.priceId.trim();
      } else if (input && typeof input.priceKey === "string" && PRICE_MAP[input.priceKey]) {
        priceId = PRICE_MAP[input.priceKey];
      } else if (input?.planKey && input?.billingCycle) {
        const price = getBillingPrice(input.planKey, input.billingCycle);
        priceId = price?.priceId ?? null;
      }

      if (!priceId) {
        const err = new Error("Plano de billing inválido.");
        setCheckoutError(err.message);
        console.error("[checkout] TEMP DEBUG — sem priceId resolvido", { input });
        return { error: err };
      }

      const origin = window.location.origin;
      const currentPath = window.location.pathname || "/";
      const successUrl = `${origin}${currentPath}?billing=success&tab=profile`;
      const cancelUrl = `${origin}${currentPath}?billing=cancel&tab=profile`;

      setCheckoutBusy(true);
      setCheckoutError("");

      try {
        // TEMP DEBUG — início do fluxo de diagnóstico (espelha o snippet solicitado + URLs exigidas pela Edge Function)
        console.log("[checkout] start", { priceId, successUrl, cancelUrl });

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        console.log("[checkout] getSession", { sessionData, sessionError });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.log("[checkout] getUser", { userData, userError });

        console.log("[checkout] supabaseUrl (env bruto)", import.meta.env.VITE_SUPABASE_URL);
        console.log("[checkout] supabaseUrl (normalizado, usado no fetch)", SUPABASE_PUBLIC_URL);

        if (sessionError || !sessionData?.session?.access_token) {
          console.error("[checkout] sem token válido", { sessionError, sessionData });
          setCheckoutError("Sessão expirada ou inválida. Entre de novo e tente outra vez.");
          alert("Sessão expirada ou inválida. Entre de novo e tente outra vez.");
          onRequireAuth?.();
          setCheckoutBusy(false);
          return { error: sessionError || new Error("NO_TOKEN") };
        }

        const accessToken = sessionData.session.access_token;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const baseUrl = SUPABASE_PUBLIC_URL || (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");

        const response = await fetch(`${baseUrl}/functions/v1/create-checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            priceId,
            successUrl,
            cancelUrl,
          }),
        });

        const rawText = await response.text();
        console.log("[checkout] response status", response.status);
        console.log("[checkout] response rawText", rawText);

        let payload = null;
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = rawText;
        }

        console.log("[checkout] parsed payload", payload);

        if (!response.ok) {
          const apiError =
            payload && typeof payload === "object" && typeof payload.error === "string"
              ? payload.error.trim()
              : "";
          const apiCode = payload && typeof payload === "object" ? payload.code : null;
          const apiDetails = payload && typeof payload === "object" ? payload.details : null;
          console.error("[checkout] response not ok", {
            status: response.status,
            code: apiCode,
            error: apiError || rawText,
            details: apiDetails,
          });
          const userMsg = [
            `HTTP ${response.status}`,
            apiCode ? `(${apiCode})` : "",
            apiError || "(sem mensagem no JSON — veja rawText acima)",
          ]
            .filter(Boolean)
            .join(" ");
          setCheckoutError(userMsg);
          alert(`Checkout falhou:\n\n${userMsg}\n\nAbra o console (F12) e procure [checkout] response rawText.`);
          setCheckoutBusy(false);
          return { error: new Error(userMsg) };
        }

        if (!payload?.url) {
          console.error("[checkout] sem url", payload);
          setCheckoutError("Checkout retornou sem URL.");
          alert("Checkout retornou sem URL.");
          setCheckoutBusy(false);
          return { error: new Error("NO_CHECKOUT_URL") };
        }

        window.location.href = payload.url;
        return { error: null };
      } catch (err) {
        console.error("[checkout] fatal error", err);
        setCheckoutError("Erro inesperado ao iniciar checkout.");
        alert("Erro inesperado ao iniciar checkout.");
        setCheckoutBusy(false);
        return { error: err };
      }
    },
    [onRequireAuth]
  );

  return useMemo(
    () => ({
      checkoutBusy,
      checkoutError,
      startCheckout,
      clearCheckoutError,
      priceMap: PRICE_MAP,
    }),
    [checkoutBusy, checkoutError, startCheckout, clearCheckoutError]
  );
}
