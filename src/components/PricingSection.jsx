import { memo, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { BILLING_PLANS, getBillingPrice } from "../lib/billing.js";
import { AiHint } from "./AiHint.jsx";

function PricingSectionComponent({
  loggedIn = false,
  currentAccess = null,
  loading = false,
  onSelectPlan,
  onRequireAuth,
  onLogin,
}) {
  const [billingCycle, setBillingCycle] = useState("monthly");

  const planList = useMemo(() => Object.values(BILLING_PLANS), []);

  return (
    <section className="aprova-pricing-section">
      <div className="aprova-section-heading aprova-pricing-heading">
        <span>Planos da Yara</span>
        <h2>Escolha o ritmo da sua assinatura sem sair da identidade do Aprova+.</h2>
        <p>
          Checkout no Stripe para a primeira compra. Portal do cliente para upgrade, downgrade e
          troca entre mensal e anual.
        </p>
        <AiHint className="aprova-pricing-ai-hint">
          Planos pensados para evolução contínua — a Yara ganha profundidade conforme você sobe de nível.
        </AiHint>
      </div>

      <div className="aprova-pricing-toggle" role="tablist" aria-label="Ciclo de cobrança">
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

      <div className="aprova-pricing-grid">
        {planList.map((plan) => {
          const price = getBillingPrice(plan.key, billingCycle);
          const isCurrent =
            currentAccess?.hasActiveSubscription &&
            ((plan.key === "pro" && currentAccess?.isPro) || (plan.key === "inicial" && currentAccess?.isInitial));

          return (
            <article
              key={plan.key}
              className={`aprova-pricing-card${plan.featured ? " is-featured" : ""}${isCurrent ? " is-current" : ""}`}
            >
              <div className="aprova-pricing-card-top">
                <div>
                  <span className="aprova-pricing-kicker">
                    {plan.featured ? <Sparkles size={14} /> : null}
                    {plan.featured ? "Mais completo" : "Base premium"}
                  </span>
                  <h3>{plan.title}</h3>
                  <p>{plan.subtitle}</p>
                </div>
                {isCurrent ? <span className="aprova-pricing-badge">Plano atual</span> : null}
              </div>

              <div className="aprova-pricing-price">
                <strong>{price?.amountLabel ?? "—"}</strong>
                <span>{price?.cadenceLabel ?? ""}</span>
              </div>

              <ul className="aprova-pricing-list">
                {plan.bullets.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={16} />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="aprova-pricing-actions">
                <button
                  type="button"
                  className="aprova-btn-interactive aprova-landing-primary"
                  disabled={loading}
                  onClick={() => {
                    if (loggedIn && onSelectPlan) {
                      void onSelectPlan({ planKey: plan.key, billingCycle });
                      return;
                    }
                    onRequireAuth?.({ planKey: plan.key, billingCycle });
                  }}
                >
                  {loggedIn ? "Assinar" : "Criar conta para assinar"}
                  <ArrowRight size={18} />
                </button>
                {!loggedIn && onLogin ? (
                  <button
                    type="button"
                    className="aprova-btn-interactive aprova-landing-secondary"
                    onClick={() => onLogin({ planKey: plan.key, billingCycle })}
                  >
                    Já tenho conta
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export const PricingSection = memo(PricingSectionComponent);
