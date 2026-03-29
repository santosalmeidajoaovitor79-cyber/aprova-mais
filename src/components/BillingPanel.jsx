import { memo, useMemo, useState } from "react";
import { CheckCircle2, Crown, CreditCard, Sparkles } from "lucide-react";
import { BILLING_PLANS, getBillingPrice } from "../lib/billing.js";

function BillingPanelComponent({
  subscription,
  access,
  loading = false,
  checkoutBusy = false,
  portalBusy = false,
  error = "",
  onSelectPlan,
  onManageSubscription,
}) {
  const [billingCycle, setBillingCycle] = useState(access?.billingCycle === "yearly" ? "yearly" : "monthly");
  const currentPlanLabel = subscription?.currentPlanBadge || "Sem assinatura ativa";
  const statusLabel = subscription?.statusLabel || "sem assinatura";
  const renewalLabel = subscription?.renewalLabel || "Sem data de renovação disponível ainda.";

  const plans = useMemo(() => Object.values(BILLING_PLANS), []);

  return (
    <section className="aprova-panel-soft is-large aprova-billing-panel">
      <div className="aprova-billing-head">
        <div>
          <span className="aprova-profile-section-kicker">Assinatura</span>
          <h2 className="aprova-profile-section-title">Billing da Yara</h2>
          <p className="aprova-profile-section-text">
            Assine com Stripe Checkout, depois gerencie upgrade, downgrade e ciclo no Customer
            Portal sem sair da estrutura atual do app.
          </p>
        </div>
        <div className="aprova-billing-current">
          <span>{currentPlanLabel}</span>
          <strong>Status: {statusLabel}</strong>
          <small>{renewalLabel}</small>
        </div>
      </div>

      <div className="aprova-billing-summary-row">
        <span className="aprova-profile-summary-pill">
          <Crown size={14} />
          {currentPlanLabel}
        </span>
        <span className="aprova-profile-summary-pill">
          <CreditCard size={14} />
          {access?.billingCycle === "yearly" ? "Cobrança anual" : access?.billingCycle === "monthly" ? "Cobrança mensal" : "Sem ciclo ativo"}
        </span>
        <span className="aprova-profile-summary-pill">
          <Sparkles size={14} />
          Checkout inicial + portal para gestão
        </span>
      </div>

      <div className="aprova-billing-toggle" role="tablist" aria-label="Escolher ciclo">
        <button
          type="button"
          className={billingCycle === "monthly" ? "is-active" : ""}
          onClick={() => setBillingCycle("monthly")}
        >
          Mensal
        </button>
        <button
          type="button"
          className={billingCycle === "yearly" ? "is-active" : ""}
          onClick={() => setBillingCycle("yearly")}
        >
          Anual
        </button>
      </div>

      <div className="aprova-billing-grid">
        {plans.map((plan) => {
          const price = getBillingPrice(plan.key, billingCycle);
          const isCurrent =
            access?.hasActiveSubscription &&
            ((plan.key === "pro" && access?.isPro) || (plan.key === "inicial" && access?.isInitial));

          return (
            <article
              key={plan.key}
              className={`aprova-billing-card${plan.featured ? " is-featured" : ""}${isCurrent ? " is-current" : ""}`}
            >
              <div className="aprova-billing-card-top">
                <div>
                  <span className="aprova-billing-kicker">{plan.featured ? "Mais completo" : "Entrada premium"}</span>
                  <h3>{plan.title}</h3>
                  <p>{plan.subtitle}</p>
                </div>
                {isCurrent ? <span className="aprova-billing-badge">Atual</span> : null}
              </div>

              <div className="aprova-billing-price">
                <strong>{price?.amountLabel ?? "—"}</strong>
                <span>{price?.cadenceLabel ?? ""}</span>
              </div>

              <ul className="aprova-billing-list">
                {plan.bullets.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="aprova-organic-primary-btn"
                disabled={loading || checkoutBusy}
                onClick={() => {
                  if (isCurrent) {
                    void onManageSubscription?.();
                    return;
                  }
                  void onSelectPlan?.({ planKey: plan.key, billingCycle });
                }}
              >
                {checkoutBusy ? "Abrindo checkout..." : isCurrent ? "Gerenciar no portal" : "Assinar"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="aprova-billing-footer">
        <button
          type="button"
          className="aprova-organic-secondary-btn"
          disabled={portalBusy || !subscription?.stripe_customer_id}
          onClick={() => void onManageSubscription?.()}
        >
          {portalBusy ? "Abrindo portal..." : "Gerenciar assinatura"}
        </button>
        <span className="aprova-billing-footer-note">
          Upgrade, downgrade e troca mensal/anual ficam concentrados no portal do Stripe.
        </span>
      </div>

      {error ? <p className="aprova-profile-inline-error">{error}</p> : null}
    </section>
  );
}

export const BillingPanel = memo(BillingPanelComponent);
