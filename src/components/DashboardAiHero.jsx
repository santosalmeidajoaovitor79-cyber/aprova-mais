import { memo } from "react";
import { Sparkles } from "lucide-react";
import { YARA_NAME, YARA_ROLE_LABEL } from "./ChatMessageBubble.jsx";

function DashboardAiHeroComponent({
  loading,
  firstName,
  vibeLine,
  mainExamName,
  examCountdownText,
  overallProgressPct,
  studyNowHint,
  suggestionShort,
  dailyFocusLabel,
  onStudyNow,
  onOpenStudyTab,
}) {
  const pct = Math.min(100, Math.max(0, Number(overallProgressPct) || 0));

  return (
    <header className="aprova-dash-ai-hero" aria-labelledby="aprova-dash-ai-hero-title">
      <div className="aprova-dash-ai-hero-glow" aria-hidden />
      <div className="aprova-dash-ai-hero-inner">
        <div className="aprova-dash-ai-hero-identity">
          <div className="aprova-dash-ai-hero-avatar" aria-hidden="true">
            <Sparkles size={26} strokeWidth={2.2} />
          </div>
          <div className="aprova-dash-ai-hero-id-text">
            <span className="aprova-dash-ai-hero-name">{YARA_NAME}</span>
            <span className="aprova-dash-ai-hero-role">{YARA_ROLE_LABEL}</span>
          </div>
        </div>

        <div className="aprova-dash-ai-hero-copy">
          <p className="aprova-dash-ai-hero-kicker">Plano ativo · Oi, {firstName}</p>
          <h2 id="aprova-dash-ai-hero-title" className="aprova-dash-ai-hero-title">
            Organizei seu estudo com base na sua prova, tempo e progresso
          </h2>
          <p className="aprova-dash-ai-hero-lede">
            {loading ? (
              "Carregando seu contexto de estudo…"
            ) : (
              <>
                <span className="aprova-dash-ai-hero-vibe">{vibeLine}</span>
                {mainExamName ? (
                  <>
                    {" "}
                    Foco em <strong>{mainExamName}</strong>
                    {examCountdownText ? (
                      <>
                        {" "}
                        · <strong>{examCountdownText}</strong>
                      </>
                    ) : null}
                    . {studyNowHint || "Abra o Estudo quando quiser — mantenho a trilha alinhada ao edital."}
                  </>
                ) : (
                  studyNowHint ||
                  "Defina seu concurso principal no perfil para eu calibrar ritmo, prioridades e próximos passos com precisão."
                )}
              </>
            )}
          </p>

          <div className="aprova-dash-ai-hero-pills" role="list">
            <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent" role="listitem">
              {loading ? "…" : examCountdownText || "Data da prova"}
            </span>
            <span className="aprova-dash-mini-pill" role="listitem">
              {loading ? "…" : mainExamName || "Concurso em definição"}
            </span>
            <span className="aprova-dash-mini-pill aprova-dash-mini-pill--focus" role="listitem">
              {loading ? "…" : dailyFocusLabel || "Foco do dia · abrir Estudo"}
            </span>
          </div>

          <div className="aprova-dash-ai-hero-progress-block">
            <div className="aprova-dash-ai-hero-progress-head">
              <span className="aprova-dash-ai-hero-progress-label">Progresso no catálogo principal</span>
              <span className="aprova-dash-ai-hero-progress-val">{loading ? "—" : `${pct}%`}</span>
            </div>
            <div
              className="aprova-dash-ai-hero-progress-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="aprova-dash-ai-hero-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            {!loading && suggestionShort ? (
              <p className="aprova-dash-ai-hero-focus-line" title={suggestionShort}>
                <span className="aprova-dash-ai-hero-focus-tag">Sugestão agora</span>{" "}
                {suggestionShort.length > 160 ? `${suggestionShort.slice(0, 158)}…` : suggestionShort}
              </p>
            ) : null}
          </div>

          <div className="aprova-dash-ai-hero-cta">
            <button type="button" className="aprova-dash-ai-cta-primary" onClick={onStudyNow}>
              Continuar estudo
            </button>
            <button type="button" className="aprova-dash-ai-cta-secondary" onClick={onOpenStudyTab}>
              Ver matérias
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export const DashboardAiHero = memo(DashboardAiHeroComponent);
