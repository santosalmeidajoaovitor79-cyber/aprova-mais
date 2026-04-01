import { memo, useMemo, useState } from "react";
import { goals } from "../constants/appConstants.js";
import { BillingPanel } from "./BillingPanel.jsx";
import { AiHint } from "./AiHint.jsx";

function ProfileOrganicPanelComponent({
  name,
  setName,
  goal,
  setGoal,
  hours,
  setHours,
  examDate,
  setExamDate,
  contests,
  mainExamId,
  setMainExamId,
  mainExamLabel,
  examSummaryLine,
  error,
  message,
  saving,
  onSaveProfile,
  topicsStudied = 0,
  topicsTotal = 0,
  quizAttempts = 0,
  nextStepHint,
  subscription,
  subscriptionAccess,
  subscriptionLoading,
  checkoutBusy,
  portalBusy,
  subscriptionError,
  onStartCheckout,
  onManageSubscription,
}) {
  const [editing, setEditing] = useState(false);

  const displayName = name?.trim() || "Seu nome";
  const examName = mainExamLabel?.trim() || "Defina seu concurso";
  const weeklyGoal = goal?.trim() || "Objetivo não definido";
  const rhythm = hours ? `${hours}h / dia` : "Ritmo não definido";
  const nextStep =
    nextStepHint?.trim() ||
    (mainExamId ? "Abra Estudo e avance um tópico" : "Escolha o concurso principal abaixo");

  const catalogSummary =
    topicsTotal > 0 ? `${topicsStudied}/${topicsTotal} tópicos com estudo` : "Catálogo ainda sem métrica";

  const progressPct =
    topicsTotal > 0 ? Math.min(100, Math.round((topicsStudied / topicsTotal) * 100)) : 0;

  const journey = useMemo(() => {
    const hasExam = Boolean(mainExamId);
    const hasTopics = topicsStudied > 0;
    const hasQuiz = quizAttempts > 0;
    const steps = [
      { key: "exam", label: "Prova em foco", done: hasExam, destination: false, pin: false },
      { key: "topics", label: "Avanço nos tópicos", done: hasTopics, destination: false, pin: false },
      {
        key: "read",
        label: "Leitura guiada",
        done: false,
        destination: false,
        pin: hasTopics && !hasQuiz,
      },
      { key: "quiz", label: "Questões do tópico", done: hasQuiz, destination: false, pin: false },
      { key: "rev", label: "Revisão sugerida", done: false, destination: false, pin: hasQuiz },
      { key: "day", label: "Dia da prova", done: false, destination: true, pin: false },
    ];
    let placed = false;
    return steps.map((s) => {
      const active = !s.destination && (s.pin || (!s.done && !placed));
      if (active) placed = true;
      return { key: s.key, label: s.label, done: s.done, active, destination: s.destination };
    });
  }, [mainExamId, topicsStudied, quizAttempts]);

  const summaryPills = useMemo(() => {
    const pills = [`Prova em foco · ${examName}`];
    if (examSummaryLine?.trim()) pills.push(examSummaryLine.trim());
    pills.push(catalogSummary);
    pills.push(`Meta da semana · ${weeklyGoal}`);
    return pills;
  }, [examName, examSummaryLine, catalogSummary, weeklyGoal]);

  return (
    <section className="aprova-profile-organic">
      <div className="aprova-profile-bg-glow aprova-profile-bg-glow-a" aria-hidden />
      <div className="aprova-profile-bg-glow aprova-profile-bg-glow-b" aria-hidden />

      <div className="aprova-profile-shell aprova-shell-wide">
        <div className="aprova-panel-soft is-large aprova-profile-hero-wrap">
          <section className="aprova-profile-hero" aria-labelledby="aprova-profile-hero-heading">
            <div className="aprova-profile-orbit-visual" aria-hidden="true">
              <div className="aprova-profile-orbit-ring aprova-profile-orbit-ring--1" />
              <div className="aprova-profile-orbit-ring aprova-profile-orbit-ring--2" />
              <div className="aprova-profile-orbit-ring aprova-profile-orbit-ring--3" />
              <div className="aprova-profile-orbit-core" />
            </div>

            <div className="aprova-profile-hero-content">
              <div className="aprova-profile-hero-copy">
                <span className="aprova-profile-kicker">Perfil e direção</span>
                <h1 id="aprova-profile-hero-heading" className="aprova-profile-title">
                  Sua preparação tem uma rota clara
                </h1>
                <p className="aprova-profile-subtitle">
                  Olá, <strong className="aprova-profile-title-inline">{displayName}</strong> — acompanhe sua prova em
                  foco, constância e próximo passo sem perder contexto.
                </p>
                <AiHint className="aprova-profile-hero-ai-hint">
                  A Yara cruza prova, ritmo e histórico para sugerir o melhor próximo passo no Estudo.
                </AiHint>
                <p className="aprova-profile-subtitle-secondary">
                  {examName !== "Defina seu concurso"
                    ? [
                        `Resumo: ${examName}.`,
                        examSummaryLine ? `${examSummaryLine}.` : null,
                        topicsTotal > 0
                          ? `Avanço registrado: ${topicsStudied} de ${topicsTotal} tópicos.`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Defina a prova em foco e a data para o Aprova+ organizar tópicos, questões e revisão até o dia D."}
                </p>

                <div className="aprova-profile-summary-row" role="list">
                  {summaryPills.map((text) => (
                    <span key={text} className="aprova-profile-summary-pill" role="listitem">
                      {text}
                    </span>
                  ))}
                </div>
              </div>

              <div className="aprova-profile-hero-status">
                <div className="aprova-profile-status-card">
                  <span className="aprova-profile-status-label">Constância de estudo</span>
                  <strong className="aprova-profile-status-value">{rhythm}</strong>
                </div>
                <div className="aprova-profile-status-card">
                  <span className="aprova-profile-status-label">Próximo passo recomendado</span>
                  <strong className="aprova-profile-status-value">{nextStep}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        {!editing ? (
          <div className="aprova-profile-page-grid">
            <div className="aprova-panel-soft is-large aprova-profile-identity-col aprova-profile-card-main">
              <span className="aprova-profile-section-kicker">Identidade e foco</span>
              <h2 className="aprova-profile-section-title">O que guia sua preparação agora</h2>
              <dl className="aprova-profile-dl">
                <div className="aprova-profile-dl-row">
                  <dt>Nome</dt>
                  <dd>{displayName}</dd>
                </div>
                <div className="aprova-profile-dl-row">
                  <dt>Prova em foco</dt>
                  <dd>{examName}</dd>
                </div>
                <div className="aprova-profile-dl-row">
                  <dt>Meta da semana</dt>
                  <dd>{weeklyGoal}</dd>
                </div>
                <div className="aprova-profile-dl-row">
                  <dt>Constância</dt>
                  <dd>{rhythm}</dd>
                </div>
                <div className="aprova-profile-dl-row">
                  <dt>Próximo passo</dt>
                  <dd>{nextStep}</dd>
                </div>
              </dl>
            </div>

            <aside className="aprova-panel-soft is-large aprova-profile-cta-col aprova-profile-card-side">
              <span className="aprova-profile-section-kicker">Ajustes</span>
              <h2 className="aprova-profile-section-title">Refine sua direção</h2>
              <p className="aprova-profile-section-text">
                Atualize prova, meta e ritmo quando mudar seu edital ou sua disponibilidade — tudo continua integrado ao
                fluxo de estudo.
              </p>
              <button
                type="button"
                className="aprova-organic-primary-btn aprova-profile-edit-trigger"
                onClick={() => setEditing(true)}
              >
                Ajustar direção
              </button>
            </aside>

            <div className="aprova-profile-card-wide">
              <BillingPanel
                subscription={subscription}
                access={subscriptionAccess}
                loading={subscriptionLoading}
                checkoutBusy={checkoutBusy}
                portalBusy={portalBusy}
                error={subscriptionError}
                onSelectPlan={onStartCheckout}
                onManageSubscription={onManageSubscription}
              />
            </div>

            <div className="aprova-panel-soft is-large aprova-profile-flow aprova-profile-journey-wrap aprova-profile-card-wide">
              <div className="aprova-profile-flow-header">
                <span className="aprova-profile-section-kicker">Progresso até a prova</span>
                <h2 className="aprova-profile-section-title">Cada tópico estudado aproxima você do dia D</h2>
                <p className="aprova-profile-section-text">
                  Concurso em foco, avanço nos tópicos, leitura com IA, questões e revisão — trilha contínua alinhada ao
                  seu edital.
                </p>
              </div>

              <div
                className="aprova-profile-catalog-progress"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso no catálogo"
              >
                <div className="aprova-profile-catalog-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="aprova-profile-catalog-progress-caption">
                {topicsTotal > 0
                  ? `${progressPct}% do catálogo com estudo registrado (${topicsStudied} de ${topicsTotal}).`
                  : "Estude tópicos no app para ver a barra de avanço aqui."}
              </p>

              <div className="aprova-profile-journey">
                <div className="aprova-profile-journey-line" aria-hidden />
                {journey.map((s) => (
                  <div
                    key={s.key}
                    className={`aprova-profile-stop${s.done ? " is-done" : ""}${s.active ? " is-active" : ""}${
                      s.destination ? " is-destination" : ""
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="aprova-grid-2 aprova-profile-main-grid aprova-profile-edit-row">
            <div className="aprova-split-main">
              <div className="aprova-panel-soft is-medium aprova-profile-fields-copy">
                <span className="aprova-profile-section-kicker">Direção e ritmo</span>
                <h2 className="aprova-profile-section-title">Ajuste o que guia sua preparação</h2>
                <p className="aprova-profile-section-text">
                  Tudo o que importa para sua preparação, em um só fluxo — defina prova, meta e constância sem perder a
                  clareza.
                </p>
              </div>
            </div>

            <div className="aprova-split-side">
              <div className="aprova-panel-soft is-large aprova-profile-form-wrap aprova-profile-form-glass">
                <label className="aprova-field-group">
                  <span className="aprova-field-label">Como podemos te chamar</span>
                  <input
                    className="aprova-organic-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Como podemos te chamar?"
                  />
                </label>

                <label className="aprova-field-group">
                  <span className="aprova-field-label">Meta da semana</span>
                  <select className="aprova-organic-select" value={goal} onChange={(e) => setGoal(e.target.value)}>
                    {goals.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="aprova-field-group">
                  <span className="aprova-field-label">Ritmo diário (horas)</span>
                  <select className="aprova-organic-select" value={hours} onChange={(e) => setHours(e.target.value)}>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4+">4+</option>
                  </select>
                </label>

                <label className="aprova-field-group">
                  <span className="aprova-field-label">Prova em foco (concurso)</span>
                  <select
                    className="aprova-organic-select"
                    value={mainExamId}
                    onChange={(e) => setMainExamId(e.target.value)}
                  >
                    <option value="">Nenhum</option>
                    {(contests ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="aprova-field-group">
                  <span className="aprova-field-label">Data da prova · opcional</span>
                  <input
                    type="date"
                    className="aprova-organic-input"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </label>

                {error ? <p className="aprova-profile-inline-error">{error}</p> : null}
                {message ? <p className="aprova-profile-inline-success">{message}</p> : null}

                <div className="aprova-profile-actions">
                  <button type="button" className="aprova-organic-primary-btn" disabled={saving} onClick={onSaveProfile}>
                    {saving ? "Salvando…" : "Salvar alterações"}
                  </button>
                  <button type="button" className="aprova-organic-secondary-btn" onClick={() => setEditing(false)}>
                    Voltar ao painel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export const ProfileOrganicPanel = memo(ProfileOrganicPanelComponent);
