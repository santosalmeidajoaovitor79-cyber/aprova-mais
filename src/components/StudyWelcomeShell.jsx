import { memo, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { ChatMessageBubble, YARA_NAME, YARA_ROLE_LABEL } from "./ChatMessageBubble.jsx";
import { ExamReadinessStrip } from "./ExamReadinessStrip.jsx";
import { PremiumFeatureCard } from "./PremiumFeatureCard.jsx";

function missionPreviewLabel(m) {
  const s = m?.label?.trim() || "";
  if (s.length <= 52) return s;
  return `${s.slice(0, 49)}…`;
}

function StudyWelcomeShellComponent({
  planKicker,
  heroTitle = "Seu plano de estudo está em movimento",
  heroLead,
  examFocusName,
  daysRemainingLabel,
  focusWeekLabel,
  weeklyMetaLine,
  nextStepTitle,
  nextStepBody,
  prioritySubjectNames,
  progressPct,
  progressLabel,
  planProgressAligned,
  topicsStudiedMain,
  topicsTotal,
  onStartNow,
  onViewFullTrail,
  onViewFullPlan,
  trailSectionRef,
  manualSectionRef,
  catalogLoading,
  selectedContest,
  subjectsList,
  selectedSubject,
  onPickSubject,
  topicsList,
  selectedTopic,
  onSelectTopic,
  suggestedTopicId,
  dailyMissions = [],
  planLines = [],
  quizWrong = 0,
  quizCorrect = 0,
  quizAttempts = 0,
  studyStreak = 0,
  hoursPerDay,
  onReviewErrors,
  onDoQuestions,
  onMissionAction,
  chatUserDisplayName = "Você",
  examReadiness = null,
  simuladoBusy = false,
  onStartAdaptiveSimulado,
  featureAccess = null,
  onUpgradeToPro,
}) {
  const progressWidth =
    typeof progressPct === "number" && Number.isFinite(progressPct)
      ? `${Math.min(100, Math.max(0, progressPct))}%`
      : "0%";

  const missionStats = useMemo(() => {
    const total = dailyMissions.length;
    const done = dailyMissions.filter((m) => m.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [dailyMissions]);

  const hoursLine = useMemo(() => {
    const h = hoursPerDay != null && hoursPerDay !== "" ? String(hoursPerDay).replace("+", "") : "2";
    return `${h}h / dia (meta no perfil)`;
  }, [hoursPerDay]);

  const trailItems = useMemo(() => {
    const list = topicsList ?? [];
    if (!list.length) {
      return {
        mode: "synthetic",
        rows: [
          {
            key: "pick",
            state: "current",
            title: "Escolha matéria e tópico",
            subtitle: "A trilha aparece aqui assim que você selecionar uma matéria no catálogo abaixo.",
            badge: "Agora",
            topic: null,
          },
          {
            key: "explain",
            state: "locked",
            title: "Explicação guiada + quiz",
            subtitle: "No tópico: leitura, questões e registro automático do que você praticou.",
            badge: "Depois",
            topic: null,
          },
          {
            key: "chat",
            state: "locked",
            title: "Chat contextual com a Yara",
            subtitle: "Dúvidas finas, resumos e padrões de prova — sempre ligado ao tópico aberto.",
            badge: "Depois",
            topic: null,
          },
        ],
      };
    }

    const cap = 7;
    const slice = list.slice(0, cap);
    let recIdx = 0;
    if (suggestedTopicId) {
      const i = slice.findIndex((t) => t.id === suggestedTopicId);
      recIdx = i >= 0 ? i : 0;
    }

    const rows = slice.map((topic, index) => {
      let state = "later";
      let badge = "Depois";
      let subtitle = "Continue na ordem sugerida para manter contexto e ritmo.";

      if (index < recIdx) {
        state = "before";
        badge = "Na trilha";
        subtitle = "Etapa anterior na sequência sugerida para hoje.";
      } else if (index === recIdx) {
        state = "recommended";
        badge = "Recomendado";
        subtitle = "Melhor ponto para continuar sem perder o fio da meada.";
      }

      return {
        key: topic.id,
        state,
        title: topic.name,
        subtitle: topic.description?.trim() || subtitle,
        badge,
        topic,
      };
    });

    const rowsWithReview = [...rows];
    if (quizWrong > 0) {
      rowsWithReview.push({
        key: "review_errors",
        state: "review",
        title: "Revisar erros recentes",
        subtitle: `${quizWrong} erro(s) registrados no concurso — vale voltar ao tópico e refazer o treino.`,
        badge: "Revisão",
        topic: null,
      });
    }
    return { mode: "topics", rows: rowsWithReview };
  }, [topicsList, suggestedTopicId, quizWrong]);

  const planPreviewLines = useMemo(() => {
    const lines = planLines ?? [];
    if (lines.length) return lines.slice(0, 5);
    const names = (prioritySubjectNames ?? []).slice(0, 3);
    if (names.length) {
      return [`Refinar ${names.join(", ")}`, "Fechar ciclo explicação → questões no mesmo dia.", "Usar o chat do tópico para lacunas pontuais."];
    }
    return ["Abrir um tópico pela trilha recomendada.", "Registrar quiz no mesmo dia para contar constância.", "Ajustar meta de horas no perfil se o ritmo mudar."];
  }, [planLines, prioritySubjectNames]);

  const assistantPreview = useMemo(() => {
    const focus = (topicsList ?? []).find((t) => t.id === suggestedTopicId)?.name?.trim();
    if (focus) {
      return `Você está com “${focus}” como foco natural da trilha. Posso explicar melhor, resumir, dar exemplos ou mostrar como isso costuma cair em prova — abra o tópico e fale comigo no chat de lá.`;
    }
    if (nextStepTitle && nextStepTitle !== "Escolha matéria e tópico") {
      return `${nextStepTitle}. Quando abrir o tópico, uso o mesmo contexto da sua prova e do seu ritmo para responder com precisão.`;
    }
    return "Organizei sua trilha com base no edital, no seu concurso em foco e no que você já praticou. Abra um tópico e me chame no chat para afinar qualquer ponto.";
  }, [topicsList, suggestedTopicId, nextStepTitle]);

  const chatPreviewRef = useRef(null);

  return (
    <section className="aprova-study-welcome-shell" aria-label="Plano de estudo">
      <div className="aprova-study-welcome-grid-page">
        <div className="aprova-study-welcome-hero">
          <div className="aprova-study-welcome-hero-main">
            <div className="aprova-study-welcome-ai-strip">
              <div className="aprova-study-welcome-ai-avatar" aria-hidden="true">
                <Sparkles size={22} strokeWidth={2.2} />
              </div>
              <div className="aprova-study-welcome-ai-id">
                <span className="aprova-study-welcome-ai-kicker">{YARA_NAME} · IA de estudo</span>
                <span className="aprova-study-welcome-ai-role">{YARA_ROLE_LABEL}</span>
              </div>
            </div>

            <span className="aprova-study-welcome-kicker">{planKicker}</span>
            <h1 className="aprova-study-welcome-title">{heroTitle}</h1>
            <p className="aprova-study-welcome-lead">{heroLead}</p>
            {weeklyMetaLine ? <p className="aprova-study-welcome-meta">{weeklyMetaLine}</p> : null}

            <div className="aprova-study-welcome-summary-row" role="list">
              <span className="aprova-study-welcome-summary-pill" role="listitem">
                Prova: {examFocusName}
              </span>
              <span className="aprova-study-welcome-summary-pill" role="listitem">
                {daysRemainingLabel}
              </span>
              <span className="aprova-study-welcome-summary-pill" role="listitem">
                Foco sugerido: {focusWeekLabel}
              </span>
            </div>

            <div className="aprova-study-welcome-progress-block">
              <div className="aprova-study-welcome-progress-head">
                <strong>
                  {typeof progressPct === "number" && Number.isFinite(progressPct)
                    ? `${Math.round(progressPct)}% do plano em movimento`
                    : "Plano pronto para ganhar ritmo"}
                </strong>
                <span className="aprova-study-welcome-progress-aside">
                  {typeof topicsStudiedMain === "number" && typeof topicsTotal === "number" && topicsTotal > 0
                    ? `${topicsStudiedMain} de ${topicsTotal} tópicos com registro`
                    : progressLabel}
                </span>
              </div>
              <div
                className="aprova-study-welcome-progress-bar"
                role="progressbar"
                aria-valuenow={typeof progressPct === "number" ? Math.round(progressPct) : 0}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="aprova-study-welcome-progress-fill" style={{ width: progressWidth }} />
              </div>
              {!planProgressAligned ? (
                <p className="aprova-study-welcome-progress-foot">
                  Você está em outro concurso agora — o progresso acima segue o seu concurso principal no perfil.
                </p>
              ) : null}
            </div>

            {featureAccess?.canUsePremiumInsights && examReadiness ? (
              <ExamReadinessStrip readiness={examReadiness} />
            ) : null}

            <div className="aprova-study-welcome-hero-cta">
              <button type="button" className="aprova-study-welcome-cta-primary" onClick={onStartNow}>
                Continuar estudo
              </button>
              <button type="button" className="aprova-study-welcome-cta-secondary" onClick={onViewFullTrail}>
                Ver trilha completa
              </button>
              <button type="button" className="aprova-study-welcome-cta-ghost" onClick={onViewFullPlan}>
                Abrir catálogo manual
              </button>
            </div>
          </div>

          <div className="aprova-study-welcome-hero-aside">
            <div className="aprova-study-welcome-focus-card">
              <span className="aprova-study-welcome-kicker aprova-study-welcome-kicker--ghost">Próximo foco</span>
              <strong className="aprova-study-welcome-focus-title">{nextStepTitle}</strong>
              <p className="aprova-study-welcome-focus-body">{nextStepBody}</p>
              <div className="aprova-study-welcome-pill-row" aria-hidden="true">
                <span className="aprova-study-welcome-pill">Explicação</span>
                <span className="aprova-study-welcome-pill">Questões</span>
                <span className="aprova-study-welcome-pill">Chat</span>
              </div>
            </div>
            <div className="aprova-study-welcome-focus-card">
              <span className="aprova-study-welcome-kicker aprova-study-welcome-kicker--ghost">Missão do dia</span>
              <strong className="aprova-study-welcome-focus-title">
                {missionStats.total ? `${missionStats.done} de ${missionStats.total} concluídos` : "Checklist em formação"}
              </strong>
              <p className="aprova-study-welcome-focus-body">
                Estudar tópico, registrar quiz, revisar o que falhou e manter constância — a Yara acompanha o que falta.
              </p>
              {missionStats.total > 0 ? (
                <div className="aprova-study-welcome-mini-progress" aria-hidden>
                  <div className="aprova-study-welcome-mini-progress-track">
                    <div className="aprova-study-welcome-mini-progress-fill" style={{ width: `${missionStats.pct}%` }} />
                  </div>
                  <span className="aprova-study-welcome-mini-progress-label">{missionStats.pct}% do dia</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--main" ref={trailSectionRef}>
          <span className="aprova-study-welcome-sheet-kicker">Trilha recomendada</span>
          <h2 className="aprova-study-welcome-sheet-title">Siga o próximo passo sem se perder</h2>
          <p className="aprova-study-welcome-sheet-lead">
            {trailItems.mode === "topics"
              ? "Ordem sugerida dentro desta matéria, com estados claros: o que já veio na rota, o foco agora e o que fica para depois."
              : "Fluxo completo do estudo com IA — começa quando você escolhe onde entrar no catálogo."}
          </p>

          <div className="aprova-study-welcome-trail-list">
            {trailItems.rows.map((row) => {
              const isReview = row.state === "review";
              const isTopicButton = Boolean(
                row.topic && (row.state === "recommended" || row.state === "before" || row.state === "later")
              );
              const Tag = isTopicButton || isReview ? "button" : "div";
              const props =
                Tag === "button"
                  ? {
                      type: "button",
                      onClick: () => {
                        if (isReview) onReviewErrors?.();
                        else if (row.topic) onSelectTopic(row.topic);
                      },
                    }
                  : {};

              return (
                <Tag
                  key={row.key}
                  {...props}
                  className={`aprova-study-welcome-trail-item aprova-study-welcome-trail-item--${row.state} ${
                    Tag === "button" ? "aprova-study-welcome-trail-item--action" : ""
                  }`}
                >
                  <span className="aprova-study-welcome-trail-dot" aria-hidden />
                  <div className="aprova-study-welcome-trail-copy">
                    <strong className="aprova-study-welcome-trail-title">{row.title}</strong>
                    <p className="aprova-study-welcome-trail-sub">{row.subtitle}</p>
                  </div>
                  <span className={`aprova-study-welcome-trail-badge aprova-study-welcome-trail-badge--${row.state}`}>
                    {row.badge}
                  </span>
                </Tag>
              );
            })}
          </div>
        </article>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--side">
          <span className="aprova-study-welcome-sheet-kicker">Revisão e treino</span>
          <h2 className="aprova-study-welcome-sheet-title">Corrija a rota com inteligência</h2>
          <p className="aprova-study-welcome-sheet-lead">Métricas do seu concurso em foco — use para decidir se hoje é dia de refino ou de volume.</p>

          <div className="aprova-study-welcome-stat-stack">
            <div className="aprova-study-welcome-stat-line">
              <span>Erros para revisar</span>
              <strong>{quizWrong}</strong>
            </div>
            <div className="aprova-study-welcome-stat-line">
              <span>Questões registradas</span>
              <strong>{quizAttempts}</strong>
            </div>
            <div className="aprova-study-welcome-stat-line">
              <span>Acertos no período</span>
              <strong>{quizCorrect}</strong>
            </div>
            <div className="aprova-study-welcome-stat-line">
              <span>Sequência (dias)</span>
              <strong>{studyStreak}</strong>
            </div>
          </div>

          <div className="aprova-study-welcome-sheet-cta-row">
            <button type="button" className="aprova-study-welcome-cta-secondary" onClick={() => onReviewErrors?.()}>
              Revisar erros
            </button>
            <button type="button" className="aprova-study-welcome-cta-primary" onClick={() => onDoQuestions?.()}>
              Fazer questões
            </button>
          </div>

          {typeof onStartAdaptiveSimulado === "function" && selectedContest?.id ? (
            <div style={{ marginTop: 18 }}>
              <p className="aprova-study-welcome-sheet-lead" style={{ marginBottom: 8 }}>
                <strong>Mini simulado adaptativo</strong> — mistura o que você mais erra com o que estudou recentemente,
                sem ficar preso num único tema. Checagem leve de prontidão; a Yara fecha com um diagnóstico curto no
                chat.
              </p>
              {featureAccess && !featureAccess.canUseAdvancedSimulado ? (
                <PremiumFeatureCard
                  compact
                  title="Simulados adaptativos entram no Yara Pro."
                  description="Quando você quiser medir ritmo, misturar fraquezas e receber um diagnóstico mais inteligente, a experiência completa está no Pro."
                  bullets={[
                    "Simulado com mistura inteligente de tópicos",
                    "Leitura curta do seu momento no final",
                    "Sem travar seu fluxo de estudo",
                  ]}
                  ctaLabel="Desbloquear Yara Pro"
                  onUpgrade={onUpgradeToPro}
                />
              ) : (
                <div className="aprova-simulado-welcome-row">
                  <button
                    type="button"
                    className="aprova-simulado-welcome-btn"
                    disabled={simuladoBusy || catalogLoading}
                    onClick={() => onStartAdaptiveSimulado(5)}
                  >
                    5 questões
                  </button>
                  <button
                    type="button"
                    className="aprova-simulado-welcome-btn"
                    disabled={simuladoBusy || catalogLoading}
                    onClick={() => onStartAdaptiveSimulado(8)}
                  >
                    8 questões
                  </button>
                  <button
                    type="button"
                    className="aprova-simulado-welcome-btn"
                    disabled={simuladoBusy || catalogLoading}
                    onClick={() => onStartAdaptiveSimulado(10)}
                  >
                    10 questões
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </article>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--half">
          <span className="aprova-study-welcome-sheet-kicker">Constância</span>
          <h2 className="aprova-study-welcome-sheet-title">{hoursLine}</h2>
          <p className="aprova-study-welcome-sheet-lead">
            {studyStreak > 0
              ? `${studyStreak} dia(s) seguido(s) com estudo registrado — ritmo mais previsível que picos isolados.`
              : "Quanto mais dias seguidos com registro, mais a trilha se ajusta ao seu hábito real (não ao plano idealizado)."}
          </p>
          <div className="aprova-study-welcome-chip-row">
            <span className="aprova-study-welcome-chip">Meta perfil</span>
            <span className="aprova-study-welcome-chip aprova-study-welcome-chip--accent">Streak {studyStreak}d</span>
          </div>
        </article>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--half">
          <span className="aprova-study-welcome-sheet-kicker">Prioridades e hábito</span>
          <h2 className="aprova-study-welcome-sheet-title">Checklist guiado</h2>
          {dailyMissions.length === 0 ? (
            <p className="aprova-study-welcome-sheet-lead">
              Assim que o painel carregar suas missões, você vê cada passo aqui com estado claro (feito ou pendente).
            </p>
          ) : (
            <ul className="aprova-study-welcome-mission-micro">
              {dailyMissions.slice(0, 5).map((m) => {
                const actionable = Boolean(m.action && onMissionAction);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`aprova-study-welcome-mission-line ${m.done ? "aprova-study-welcome-mission-line--done" : ""}`}
                      disabled={m.done || !actionable}
                      onClick={() => actionable && onMissionAction(m)}
                    >
                      <span className="aprova-study-welcome-mission-dot" aria-hidden>
                        {m.done ? "✓" : ""}
                      </span>
                      <span className="aprova-study-welcome-mission-text">{missionPreviewLabel(m)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--wide">
          <span className="aprova-study-welcome-sheet-kicker">Próximos passos da IA</span>
          <h2 className="aprova-study-welcome-sheet-title">O que faz sentido depois do momento atual</h2>
          <ol className="aprova-study-welcome-plan-steps">
            {planPreviewLines.map((line, i) => (
              <li key={i} className="aprova-study-welcome-plan-step">
                <span className="aprova-study-welcome-plan-step-index">{i + 1}</span>
                <span className="aprova-study-welcome-plan-step-text">{line}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="aprova-study-welcome-sheet aprova-study-welcome-sheet--wide aprova-study-welcome-chat-card" ref={chatPreviewRef}>
          <div className="aprova-study-welcome-chat-card-head">
            <div>
              <span className="aprova-study-welcome-sheet-kicker">Chat com a Yara</span>
              <h2 className="aprova-study-welcome-sheet-title aprova-study-welcome-chat-card-title">Tire dúvidas no contexto do tópico</h2>
              <p className="aprova-study-welcome-sheet-lead aprova-study-welcome-chat-card-lead">
                Preview do layout premium usado dentro do tópico — histórico real fica salvo por matéria.
              </p>
            </div>
            <span className="aprova-study-welcome-chat-hint-pill">Ao abrir o tópico</span>
          </div>

          <div className="aprova-study-welcome-chat-thread aprova-chat-thread">
            <ChatMessageBubble role="assistant" content={assistantPreview} userName={chatUserDisplayName} />
            <ChatMessageBubble role="user" content="Me explica isso de forma mais fácil, com um exemplo." userName={chatUserDisplayName} />
          </div>

          <div className="aprova-study-welcome-chat-input-row">
            <input
              type="text"
              className="aprova-study-welcome-chat-input"
              disabled
              readOnly
              placeholder="Abra um tópico para enviar mensagens reais…"
              aria-label="Campo de mensagem (disponível no tópico)"
            />
            <button type="button" className="aprova-study-welcome-cta-primary" disabled>
              Enviar
            </button>
          </div>
        </article>

        <div className="aprova-study-welcome-selector" ref={manualSectionRef} data-aprova-manual-selector>
          <div className="aprova-study-welcome-selector-head">
            <div>
              <span className="aprova-study-welcome-kicker aprova-study-welcome-kicker--ghost">Escolha manual</span>
              <h2 className="aprova-study-welcome-selector-title">Catálogo: matéria e tópico</h2>
            </div>
            <span className="aprova-study-welcome-selector-chip">Catálogo + IA</span>
          </div>

          <div className="aprova-study-welcome-selector-grid">
            <div className="aprova-study-welcome-selector-box">
              <h3 className="aprova-study-welcome-box-heading">Matérias</h3>
              {!selectedContest ? (
                <div className="aprova-study-welcome-panel-empty">
                  Escolha um concurso acima ou aguarde o carregamento automático.
                </div>
              ) : catalogLoading ? (
                <div className="aprova-study-welcome-panel-empty">Carregando matérias…</div>
              ) : subjectsList.length === 0 ? (
                <div className="aprova-study-welcome-panel-empty">Nenhuma matéria para este concurso.</div>
              ) : (
                <div className="aprova-study-welcome-subject-grid">
                  {subjectsList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onPickSubject(s)}
                      className={
                        selectedSubject?.id === s.id
                          ? "aprova-study-welcome-subject-chip aprova-study-welcome-subject-chip--active"
                          : "aprova-study-welcome-subject-chip"
                      }
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="aprova-study-welcome-selector-box">
              <h3 className="aprova-study-welcome-box-heading">Tópicos</h3>
              {!selectedSubject ? (
                <div className="aprova-study-welcome-topic-empty">
                  <div className="aprova-study-welcome-topic-empty-icon" aria-hidden="true">
                    <Sparkles size={22} strokeWidth={2.2} />
                  </div>
                  <strong className="aprova-study-welcome-topic-empty-title">Trilha por matéria</strong>
                  <p className="aprova-study-welcome-topic-empty-copy">
                    Selecione uma matéria para a Yara liberar os tópicos e a ordem sugerida — alinhada ao edital e ao que você já praticou.
                  </p>
                </div>
              ) : catalogLoading ? (
                <div className="aprova-study-welcome-panel-empty">Carregando tópicos…</div>
              ) : topicsList.length === 0 ? (
                <div className="aprova-study-welcome-panel-empty">Nenhum tópico cadastrado para esta matéria.</div>
              ) : (
                <div className="aprova-study-welcome-topic-grid">
                  {topicsList.map((topic) => {
                    const isSuggested = suggestedTopicId && topic.id === suggestedTopicId;
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => onSelectTopic(topic)}
                        className={
                          selectedTopic?.id === topic.id
                            ? "aprova-study-welcome-topic-card aprova-study-welcome-topic-card--active"
                            : "aprova-study-welcome-topic-card"
                        }
                      >
                        <span className="aprova-study-welcome-topic-card-head">
                          <span className="aprova-study-welcome-topic-card-title">{topic.name}</span>
                          {isSuggested ? (
                            <span className="aprova-study-welcome-topic-suggested-pill">Sugerido</span>
                          ) : null}
                        </span>
                        {topic.description ? (
                          <span className="aprova-study-welcome-topic-card-desc">{topic.description}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const StudyWelcomeShell = memo(StudyWelcomeShellComponent);
