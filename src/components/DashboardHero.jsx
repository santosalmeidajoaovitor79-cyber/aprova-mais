import { memo } from "react";
import { AiHint } from "./AiHint.jsx";

/**
 * Hero principal do dashboard — próximo passo + CTA, tema dark premium Yara.
 * Props estáveis com o hub: não alterar nomes sem atualizar DashboardStudyHub.
 */
function DashboardHeroComponent({
  userName,
  loading = false,
  nextStep,
  aiHint,
  progressPct,
  mainExamName,
  examCountdownText,
  dailyFocusLabel,
  onStart,
  onViewPlan,
  secondaryChips,
}) {
  const pct = Math.min(100, Math.max(0, Number(progressPct) || 0));
  const description = loading
    ? "Carregando seu contexto e o melhor próximo passo…"
    : nextStep?.description?.trim() ||
      "Continuar seu edital com foco no que a Yara priorizou para o seu ritmo hoje.";

  const defaultHint =
    "A Yara ajustou seu plano com base no seu desempenho recente e no prazo da prova.";

  return (
    <section className="aprova-dashboard-hero" aria-labelledby="aprova-dashboard-hero-title">
      <div className="aprova-dashboard-hero__glow" aria-hidden="true" />

      <div className="aprova-dashboard-hero__content">
        <span className="aprova-dashboard-hero__kicker">Plano ativo da Yara</span>

        <h1 id="aprova-dashboard-hero-title" className="aprova-dashboard-hero__title">
          {userName
            ? `${userName}, aqui está seu próximo passo`
            : "Aqui está seu próximo passo"}
        </h1>

        <p className="aprova-dashboard-hero__description">{description}</p>

        {!loading ? <AiHint>{aiHint || defaultHint}</AiHint> : null}

        {!loading && (mainExamName || examCountdownText || dailyFocusLabel) ? (
          <div className="aprova-dashboard-hero__pills" role="list">
            {mainExamName ? (
              <span className="aprova-dashboard-hero__pill" role="listitem">
                {mainExamName.length > 36 ? `${mainExamName.slice(0, 34)}…` : mainExamName}
              </span>
            ) : null}
            {examCountdownText ? (
              <span className="aprova-dashboard-hero__pill aprova-dashboard-hero__pill--accent" role="listitem">
                {examCountdownText}
              </span>
            ) : null}
            {dailyFocusLabel ? (
              <span className="aprova-dashboard-hero__pill aprova-dashboard-hero__pill--focus" role="listitem">
                {dailyFocusLabel.length > 56 ? `${dailyFocusLabel.slice(0, 54)}…` : dailyFocusLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="aprova-dashboard-hero__progress" aria-label="Progresso no catálogo principal">
          <div className="aprova-dashboard-hero__progress-head">
            <span>Progresso no catálogo</span>
            <strong>{loading ? "—" : `${pct}%`}</strong>
          </div>
          <div
            className="aprova-dashboard-hero__progress-track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="aprova-dashboard-hero__progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="aprova-dashboard-hero__actions">
          <button type="button" className="aprova-dashboard-hero__primary" onClick={onStart}>
            Começar agora
          </button>
          <button type="button" className="aprova-dashboard-hero__secondary" onClick={onViewPlan}>
            Ver plano completo
          </button>
        </div>

        {!loading && secondaryChips?.length ? (
          <div className="aprova-dashboard-hero__chips" role="group" aria-label="Atalhos rápidos">
            {secondaryChips.map((chip) => (
              <button key={chip.label} type="button" className="aprova-chip-btn" onClick={chip.onClick}>
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const DashboardHero = memo(DashboardHeroComponent);
