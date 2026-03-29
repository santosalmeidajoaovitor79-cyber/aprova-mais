export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";

export const BILLING_STATUS_LABELS = {
  inactive: "inativa",
  checkout_pending: "checkout pendente",
  trialing: "em teste",
  active: "ativa",
  past_due: "pagamento pendente",
  canceled: "cancelada",
  unpaid: "inadimplente",
  incomplete: "incompleta",
  incomplete_expired: "expirada",
  paused: "pausada",
};

export const BILLING_PLANS = {
  inicial: {
    key: "inicial",
    title: "Yara Inicial",
    subtitle: "O essencial para estudar com direção e continuidade.",
    prices: {
      monthly: {
        priceId: "price_1TGG1XBBsAS1lAp1UGeMhyj0",
        amountLabel: "R$ 39",
        cadenceLabel: "/mês",
      },
      yearly: {
        priceId: "price_1TGGHuBBsAS1lAp14HcpcTHS",
        amountLabel: "R$ 390",
        cadenceLabel: "/ano",
      },
    },
    bullets: [
      "Plano guiado pela Yara",
      "Explicações e prática no mesmo fluxo",
      "Retomada do ponto certo",
    ],
  },
  pro: {
    key: "pro",
    title: "Yara Pro",
    subtitle: "Mais profundidade, mais autonomia e gestão completa da evolução.",
    prices: {
      monthly: {
        priceId: "price_1TGG3CBBsAS1lAp12hzsTwcu",
        amountLabel: "R$ 79",
        cadenceLabel: "/mês",
      },
      yearly: {
        priceId: "price_1TGGGtBBsAS1lAp1j6wF62D9",
        amountLabel: "R$ 790",
        cadenceLabel: "/ano",
      },
    },
    bullets: [
      "Tudo do Inicial",
      "Camada premium para evolução contínua",
      "Gestão de assinatura e upgrades pelo portal Stripe",
    ],
    featured: true,
  },
};

export const PREMIUM_ACTIVE_STATUSES = new Set(["trialing", "active", "past_due"]);

export function getBillingPrice(planKey, billingCycle) {
  return BILLING_PLANS?.[planKey]?.prices?.[billingCycle] || null;
}

export function getPlanTitle(planKey) {
  return BILLING_PLANS?.[planKey]?.title || "Sem plano";
}

export function getStatusLabel(status) {
  return BILLING_STATUS_LABELS?.[status] || "sem assinatura";
}

export function buildSubscriptionAccess(subscription) {
  const planKey = typeof subscription?.plan_key === "string" ? subscription.plan_key.trim() : "";
  const status = typeof subscription?.status === "string" ? subscription.status.trim() : "inactive";
  const billingCycle = typeof subscription?.billing_cycle === "string" ? subscription.billing_cycle.trim() : "";
  const hasActiveSubscription = PREMIUM_ACTIVE_STATUSES.has(status);

  return {
    planKey,
    status,
    billingCycle,
    isInitial: hasActiveSubscription && planKey === "inicial",
    isPro: hasActiveSubscription && planKey === "pro",
    hasActiveSubscription,
    isManagedInPortal: Boolean(subscription?.stripe_customer_id),
  };
}

export function formatBillingDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getRenewalLabel(subscription) {
  const dateLabel = formatBillingDate(subscription?.current_period_end);
  if (!dateLabel) return "";
  if (subscription?.cancel_at_period_end) {
    return `Acesso até ${dateLabel}`;
  }
  return `Próxima renovação em ${dateLabel}`;
}

export function getCurrentPlanBadge(access) {
  if (access?.isPro) return "Plano atual: Yara Pro";
  if (access?.isInitial) return "Plano atual: Yara Inicial";
  return "Sem assinatura ativa";
}
