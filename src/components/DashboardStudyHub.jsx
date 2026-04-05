import { memo, useEffect, useMemo, useRef, useState } from "react";
import { styles } from "../styles/appStyles.js";
import { computeDaysUntilExam } from "../utils/examDate.js";
import { PremiumFeatureCard } from "./PremiumFeatureCard.jsx";

const MISSION_SHORT = {
  errors_priority: "Prioridade: erros",
  visit_today: "Estudar 1 tópico",
  quiz_today: "Registrar quiz hoje",
  catalog_progress: "Avançar catálogo",
  exam_focus: "Conteúdo + quiz",
  combo: "Tópico + quiz",
  fix_errors: "Rever erros",
};

function formatHistoryStepDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return null;
  }
}

function missionShortLabel(m) {
  if (MISSION_SHORT[m.id]) return MISSION_SHORT[m.id];
  const t = m.label || "";
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
}

function DashboardStudyHubComponent({
  displayName,
  loading,
  examDate,
  examCountdownText,
  mainExamName,
  studyNowHint,
  onStudyNow,
  lastTopicLabel,
  continueProgressLine,
  onContinueStudy,
  onReviewErrors,
  onDoQuestions,
  topicsStudied,
  topicsTotal,
  questionSends,
  quizAttempts,
  quizCorrect,
  quizWrong,
  studyDays,
  suggestion,
  planLines,
  studyStreak,
  overallProgressPct,
  subjectProgress,
  adaptiveFocusHint,
  dailyMissions,
  evolutionLines,
  recentRows,
  commandCenter,
  resumeJourney,
  onOpenStudyTab,
  onMissionAction,
  onResumeAction,
  featureAccess = null,
  onUpgradeToPro,
}) {
  const [missionToast, setMissionToast] = useState(null);
  const missionsInitRef = useRef(false);
  const prevMissionDoneRef = useRef(null);

  const daysLeft = computeDaysUntilExam(examDate);
  const recentShort = recentRows.slice(0, 5);

  const missionStats = useMemo(() => {
    const total = dailyMissions.length;
    const done = dailyMissions.filter((m) => m.done).length;
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [dailyMissions]);

  useEffect(() => {
    if (loading) return;
    const { total, done } = missionStats;
    if (!missionsInitRef.current) {
      missionsInitRef.current = true;
      prevMissionDoneRef.current = done;
      return;
    }
    const prev = prevMissionDoneRef.current;
    if (prev !== null && done > prev && total > 0) {
      const text =
        done === total && prev < total
          ? "Tudo feito hoje. Amanhã seguimos firmes!"
          : "Missão ok. Continue assim!";
      queueMicrotask(() => setMissionToast({ text }));
    }
    prevMissionDoneRef.current = done;
  }, [loading, missionStats]);

  useEffect(() => {
    if (!missionToast) return;
    const t = window.setTimeout(() => setMissionToast(null), 4500);
    return () => window.clearTimeout(t);
  }, [missionToast]);

  const progressPct = Math.min(100, Math.max(0, Number(overallProgressPct) || 0));
  const subjectAside = Boolean(!loading && subjectProgress?.length);
  const center = commandCenter ?? {};
  const firstPendingMission = dailyMissions.find((m) => !m.done && m.action);
  const premiumInsightsLocked = Boolean(featureAccess && !featureAccess.canUsePremiumInsights);

  const dailyFocusLabel = useMemo(() => {
    if (dailyMissions.length > 0) return `Foco · ${missionShortLabel(dailyMissions[0])}`;
    const h = adaptiveFocusHint?.trim();
    if (h) return h.length > 72 ? `${h.slice(0, 70)}…` : h;
    return null;
  }, [dailyMissions, adaptiveFocusHint]);

  const examHint =
    daysLeft !== null && daysLeft >= 0
      ? daysLeft === 0
        ? "Prova hoje"
        : `${daysLeft}d até a prova`
      : daysLeft !== null && daysLeft < 0
        ? "Prova já passou"
        : null;

  const continueHint =
    lastTopicLabel || continueProgressLine
      ? lastTopicLabel
        ? `Retomando · “${lastTopicLabel.length > 32 ? `${lastTopicLabel.slice(0, 30)}…` : lastTopicLabel}”`
        : continueProgressLine
      : studyNowHint ||
        "Abrimos o conteúdo mais relevante para o seu momento de estudo, sem você perder tempo procurando onde retomar.";

  const resumeTopicShort =
    lastTopicLabel && lastTopicLabel.length > 52 ? `${lastTopicLabel.slice(0, 50)}…` : lastTopicLabel;

  const catalogLabel =
    topicsTotal > 0 ? `${topicsStudied}/${topicsTotal}` : loading ? "—" : String(topicsStudied ?? "—");

  function runCommandCenterAction(action) {
    if (action === "chat") {
      onResumeAction?.("chat");
      return;
    }
    if (action === "study_now") {
      onStudyNow?.();
      return;
    }
    if (action === "review_errors") {
      onReviewErrors?.();
      return;
    }
    if (action === "do_questions") {
      onDoQuestions?.();
      return;
    }
    if (onResumeAction && action === "review_errors") {
      onResumeAction("review_errors");
      return;
    }
    onOpenStudyTab?.();
  }

  const nextFocusPanel = (
    <aside className="aprova-dash-organic-panel aprova-dash-organic-panel-focus aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-4 aprova-dash-card--side">
      <span className="aprova-dash-card-kicker">{center?.nextBestStep?.title || "Próximo melhor passo"}</span>
      <h3 className="aprova-dash-card-heading-sm">{loading ? "Carregando…" : center?.nextBestStep?.emphasis || "Sugestão inteligente"}</h3>
      <p className="aprova-dash-card-text-clamp" title={suggestion || ""}>
        {loading
          ? "Carregando…"
          : center?.nextBestStep?.text ||
            suggestion ||
            "A Yara prioriza o próximo tópico com base no seu ritmo e no edital."}
      </p>
      <div className="aprova-dash-card-meta-row" aria-hidden="true">
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">{loading ? "…" : center?.nextBestStep?.emphasis || "Hoje"}</span>
        <span className="aprova-dash-mini-pill">Prioridade</span>
        {examHint ? <span className="aprova-dash-mini-pill">{examHint}</span> : null}
      </div>
      {planLines.length > 0 ? (
        <ul className="aprova-dash-card-bullet-list">
          {planLines.slice(0, 2).map((line, i) => (
            <li key={i}>{line.length > 120 ? `${line.slice(0, 118)}…` : line}</li>
          ))}
        </ul>
      ) : (
        <div className="aprova-dash-card-pill-row">
          <span className="aprova-dash-stat-pill-tag">Explicação</span>
          <span className="aprova-dash-stat-pill-tag">Questões</span>
          <span className="aprova-dash-stat-pill-tag">Chat Yara</span>
        </div>
      )}
      <div className="aprova-dash-ai-hero-cta" style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => runCommandCenterAction(center?.nextBestStep?.ctaAction)}
          className="aprova-btn-interactive"
          style={{ ...styles.dashV2ActionBtn, ...styles.dashV2ActionBtnPurple, padding: "12px 10px" }}
        >
          {loading ? "Abrir" : center?.nextBestStep?.ctaLabel || "Abrir estudo"}
          <span style={styles.dashV2ActionSub}>{loading ? "…" : center?.nextBestStep?.emphasis || "Agora"}</span>
        </button>
      </div>
    </aside>
  );

  const momentPanel = premiumInsightsLocked ? (
    <PremiumFeatureCard
      compact
      className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half"
      title="A leitura mais profunda do seu momento fica no Yara Pro."
      description="No Pro, a Yara cruza prazo, progresso e sinais de erro para mostrar o que merece sua energia agora."
      bullets={["Visão do momento", "Prioridade mais inteligente", "Leitura premium da semana"]}
      ctaLabel="Ativar Yara Pro"
      onUpgrade={onUpgradeToPro}
    />
  ) : (
    <section className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half">
      <span className="aprova-dash-card-kicker">{center?.momentVision?.title || "Visão do momento"}</span>
      <h3 className="aprova-dash-card-heading-sm">{loading ? "Carregando…" : center?.momentVision?.headline || "Seu momento de estudo"}</h3>
      <div className="aprova-dash-card-meta-row">
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">
          {loading ? "…" : center?.momentVision?.prepLabel || "Preparação"}
        </span>
        <span className="aprova-dash-mini-pill">{loading ? "…" : examHint || "Semana"}</span>
      </div>
      <p className="aprova-dash-card-text-clamp">
        {loading
          ? "Carregando leitura do momento…"
          : center?.momentVision?.text ||
            "Seu painel cruza prazo, progresso e revisão para indicar o que merece mais energia agora."}
      </p>
      <div
        className="aprova-dash-organic-hint aprova-dash-card-hint-box"
        style={{ ...styles.dashV2Adaptive, marginTop: 12 }}
        role="status"
      >
        {loading ? "…" : center?.weekAttention || adaptiveFocusHint || "Nada crítico domina a semana no momento."}
      </div>
    </section>
  );

  const yaraRecommendationPanel = premiumInsightsLocked ? (
    <PremiumFeatureCard
      compact
      className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half"
      title="As recomendações premium da Yara entram no Pro."
      description="Continue com o dashboard base e libere a camada mais estratégica quando quiser orientação mais profunda."
      bullets={["Recomendações mais inteligentes", "Leitura premium da Yara", "Ajustes mais finos de prioridade"]}
      ctaLabel="Ver Yara Pro"
      onUpgrade={onUpgradeToPro}
    />
  ) : (
    <section className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half">
      <span className="aprova-dash-card-kicker">{center?.yaraRecommendation?.title || "Recomendação da Yara"}</span>
      <h3 className="aprova-dash-card-heading-sm">Leitura curta e útil</h3>
      <p className="aprova-dash-card-text-clamp">
        {loading
          ? "Carregando…"
          : center?.yaraRecommendation?.text ||
            "A Yara usa sua constância, seus erros e seu progresso para orientar o próximo ajuste."}
      </p>
      {!loading && center?.yaraRecommendation?.support ? (
        <div
          className="aprova-dash-organic-hint aprova-dash-card-hint-box"
          style={{ ...styles.dashV2Adaptive, marginTop: 12 }}
          role="status"
        >
          {center.yaraRecommendation.support}
        </div>
      ) : null}
    </section>
  );

  const progressPill = (
    <section className="aprova-dash-organic-stat-pill aprova-dash-organic-stat-progress aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half">
      <span className="aprova-dash-card-kicker aprova-dash-card-kicker--green">Progresso até a prova</span>
      <p className="aprova-dash-card-metric">{loading ? "—" : `${progressPct}%`}</p>
      <div className="aprova-dash-card-progress-line" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="aprova-dash-card-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="aprova-dash-card-meta-row">
        <span className="aprova-dash-mini-pill">{mainExamName ? (mainExamName.length > 20 ? `${mainExamName.slice(0, 18)}…` : mainExamName) : "Edital"}</span>
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">{examHint || examCountdownText || "Ritmo"}</span>
      </div>
      <p className="aprova-dash-card-foot">
        Avanço acumulado no concurso principal — use o Estudo para converter em sessões.
      </p>
    </section>
  );

  const streakPill = (
    <div className="aprova-dash-organic-stat-pill aprova-dash-organic-stat-streak aprova-dash-card-skin aprova-dash-card--compact">
      <span className="aprova-dash-card-kicker">Constância</span>
      <p className="aprova-dash-card-metric aprova-dash-card-metric--amber">{loading ? "—" : studyStreak}</p>
      <div className="aprova-dash-card-meta-row">
        <span className="aprova-dash-mini-pill">Dias seguidos</span>
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">{loading ? "…" : studyStreak > 0 ? "No ritmo" : "Comece hoje"}</span>
      </div>
      <p className="aprova-dash-card-foot">
        {loading ? "…" : studyStreak > 0 ? "Sequência ativa — mantenha o hábito." : "Primeiro passo: abra um tópico no Estudo."}
      </p>
    </div>
  );

  const revisionTrainPanel = (
    <div className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-card--compact">
      <span className="aprova-dash-card-kicker">Revisão e treino</span>
      <h3 className="aprova-dash-card-heading-sm">Reforço guiado</h3>
      <div className="aprova-dash-card-meta-row">
        <span className="aprova-dash-mini-pill">Erros · {loading ? "—" : quizWrong}</span>
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">Quiz</span>
      </div>
      <div className="aprova-dash-organic-action-row" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" onClick={onReviewErrors} className="aprova-btn-interactive" style={{ ...styles.dashV2ActionBtn, ...styles.dashV2ActionBtnYellow, padding: "12px 10px" }}>
          Revisar erros
          <span style={{ ...styles.dashV2ActionSub, color: "rgba(28,25,23,0.85)" }}>{quizWrong > 0 ? `${quizWrong}` : "—"}</span>
        </button>
        <button type="button" onClick={onDoQuestions} className="aprova-btn-interactive" style={{ ...styles.dashV2ActionBtn, ...styles.dashV2ActionBtnGreen, padding: "12px 10px" }}>
          Fazer questões
          <span style={{ ...styles.dashV2ActionSub, color: "rgba(255,255,255,0.9)" }}>Treino</span>
        </button>
      </div>
      {!loading && adaptiveFocusHint ? (
        <div className="aprova-dash-organic-hint aprova-dash-card-hint-box" style={{ ...styles.dashV2Adaptive, marginTop: 12 }} role="status">
          {adaptiveFocusHint}
        </div>
      ) : null}
    </div>
  );

  const evolutionPanel = (
    <section className="aprova-dash-organic-panel aprova-dash-organic-evolution aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-6 aprova-dash-card--half">
      <span className="aprova-dash-section-kicker">{center?.progressRecent?.title || "Evolução"}</span>
      <h2 className="aprova-dash-section-heading aprova-dash-card-heading-tight">Progresso recente e pontos frágeis</h2>
      <p className="aprova-dash-section-lede aprova-dash-card-lede-tight">
        {loading
          ? "Indicadores atualizados pela Yara conforme você estuda e pratica."
          : center?.progressRecent?.headline || "Indicadores atualizados pela Yara conforme você estuda e pratica."}
      </p>
      <div className="aprova-dash-stat-grid">
        <div className="aprova-dash-stat-cell">
          <p className="aprova-dash-stat-val">{loading ? "—" : topicsTotal > 0 ? `${topicsStudied}/${topicsTotal}` : topicsStudied}</p>
          <p className="aprova-dash-stat-lbl">Catálogo</p>
        </div>
        <div className="aprova-dash-stat-cell">
          <p className="aprova-dash-stat-val">{loading ? "—" : quizAttempts}</p>
          <p className="aprova-dash-stat-lbl">Questões</p>
        </div>
        <div className="aprova-dash-stat-cell">
          <p className="aprova-dash-stat-val">{loading ? "—" : studyDays}</p>
          <p className="aprova-dash-stat-lbl">Dias com estudo</p>
        </div>
        <div className="aprova-dash-stat-cell">
          <p className="aprova-dash-stat-val">{loading ? "—" : questionSends}</p>
          <p className="aprova-dash-stat-lbl">IA nos tópicos</p>
        </div>
      </div>
      {!loading && quizAttempts > 0 ? (
        <p className="aprova-dash-evolution-quiz-line">
          <span className="aprova-dash-evolution-quiz-ok">{quizCorrect} acertos</span>
          <span className="aprova-dash-evolution-quiz-sep"> · </span>
          <span className="aprova-dash-evolution-quiz-review">{quizWrong} reforço</span>
        </p>
      ) : null}
      {evolutionLines.length > 0 ? (
        <div className="aprova-dash-evolution-chips">
          {evolutionLines.slice(0, 4).map((line, i) => (
            <span key={i} className="aprova-dash-evolution-chip" title={line}>
              {line.length > 40 ? `${line.slice(0, 38)}…` : line}
            </span>
          ))}
        </div>
      ) : (
        <p className="aprova-dash-section-muted">Pratique questões no Estudo para ver chips de evolução aqui.</p>
      )}
      {!loading ? (
        <div className="aprova-dash-evolution-chips" style={{ marginTop: 12 }}>
          {(center?.progressRecent?.weakTopics?.length
            ? center.progressRecent.weakTopics
            : [center?.progressRecent?.fallbackWeakLine]
          )
            .filter(Boolean)
            .slice(0, 3)
            .map((line, i) => (
              <span key={`fragile-${i}`} className="aprova-dash-evolution-chip" title={line}>
                {line.length > 54 ? `${line.slice(0, 52)}…` : line}
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );

  const historyPanel = (
    <section
      className={`aprova-dash-organic-panel aprova-dash-organic-history aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-card--half ${
        subjectAside ? "aprova-dash-span-6" : "aprova-dash-span-12"
      }`}
    >
      <span className="aprova-dash-section-kicker">Histórico</span>
      <h2 className="aprova-dash-section-heading aprova-dash-card-heading-tight">Trilha recente</h2>
      <div className="aprova-dash-card-meta-row">
        <span className="aprova-dash-mini-pill">{recentShort.length} passos</span>
        <span className="aprova-dash-mini-pill aprova-dash-mini-pill--accent">Sincronizado</span>
      </div>
      {loading ? (
        <p className="aprova-dash-section-muted">Carregando sua trilha…</p>
      ) : recentShort.length === 0 ? (
        <p className="aprova-dash-section-muted">
          Nada aqui ainda. Use <strong>Continuar estudo</strong> no bloco da Yara acima.
        </p>
      ) : (
        <ul className="aprova-dash-history-trail aprova-dash-history-flex-grow" aria-label="Passos recentes de estudo">
          {recentShort.map((rowItem) => {
            const topic =
              rowItem.topicName.length > 56 ? `${rowItem.topicName.slice(0, 54)}…` : rowItem.topicName;
            const when = formatHistoryStepDate(rowItem.visitedAt);
            return (
              <li key={`${rowItem.topicId}-${rowItem.visitedAt}`} className="aprova-dash-history-step">
                <span className="aprova-dash-history-step-dot" aria-hidden />
                <div className="aprova-dash-history-step-body">
                  <p className="aprova-dash-history-step-title">Você estudou · {topic}</p>
                  {rowItem.subjectName ? (
                    <p className="aprova-dash-history-step-meta">Matéria · {rowItem.subjectName}</p>
                  ) : null}
                  {when ? <p className="aprova-dash-history-step-date">{when}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="aprova-dash-history-actions">
        <button type="button" onClick={onOpenStudyTab} className="aprova-btn-interactive aprova-dash-history-link" style={styles.dashV2LinkBtn}>
          Ver matérias
        </button>
        <button type="button" onClick={onContinueStudy} className="aprova-btn-interactive aprova-dash-history-link" style={styles.dashV2LinkBtn}>
          Escolher outro tópico
        </button>
      </div>
    </section>
  );

  const planWideCard =
    planLines.length > 0 ? (
      <section className="aprova-dash-organic-panel aprova-dash-organic-band-flow aprova-dash-card-skin aprova-dash-span-12 aprova-dash-card--wide">
        <span className="aprova-dash-card-kicker">Próximos passos · IA</span>
        <h2 className="aprova-dash-section-heading aprova-dash-card-heading-tight">Rota sugerida nos próximos dias</h2>
        <p className="aprova-dash-section-lede aprova-dash-card-lede-tight">
          Ajusto estas linhas conforme você avança no catálogo e no quiz.
        </p>
        <ul className="aprova-dash-wide-task-list">
          {planLines.slice(0, 6).map((line, i) => (
            <li key={i} className="aprova-dash-wide-task-item">
              <span className="aprova-dash-wide-task-dot" aria-hidden />
              <span>{line.length > 200 ? `${line.slice(0, 198)}…` : line}</span>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <section className="aprova-dashboard-organic">
      <div className="aprova-dashboard-organic-inner aprova-container">
        <div className="aprova-dashboard-editorial">
          <section className="aprova-dashboard-hero-main">
            <span className="aprova-profile-section-kicker">Plano ativo da Yara</span>
            <h1 className="aprova-dashboard-hero-main__title">
              {loading ? "Organizando seu próximo passo…" : center?.quickResume?.headline || "Seu próximo passo está claro"}
            </h1>
            <p className="aprova-dashboard-hero-main__description">
              {loading ? "Carregando contexto do seu estudo…" : center?.quickResume?.text || continueHint}
            </p>
            <p className="aprova-ai-hint">
              {loading
                ? "A Yara está ajustando sua trilha."
                : center?.nextBestStep?.text ||
                  suggestion ||
                  "A Yara ajustou sua rota com base no seu progresso recente."}
            </p>
            <div className="aprova-dashboard-hero-main__actions">
              <button
                type="button"
                className="aprova-organic-primary-btn"
                onClick={() => onResumeAction?.(resumeJourney?.primaryAction || center?.nextBestStep?.ctaAction || "study_now")}
              >
                {resumeJourney?.primaryLabel || "Continuar estudo"}
              </button>
              <button
                type="button"
                className="aprova-organic-secondary-btn"
                onClick={onOpenStudyTab}
              >
                Ver plano completo
              </button>
            </div>
          </section>

          <section className="aprova-dashboard-strip">
            <div>
              <strong>{loading ? "—" : `${progressPct}%`}</strong>
              <span> progresso até a prova</span>
            </div>
            <div>
              <strong>{loading ? "—" : examHint || examCountdownText || "Ritmo"}</strong>
              <span> até a prova</span>
            </div>
            <div>
              <strong>{loading ? "—" : `${studyStreak} dias`}</strong>
              <span> de constância recente</span>
            </div>
          </section>

          <section className="aprova-dashboard-section">
            <span className="aprova-profile-section-kicker">Retomada</span>
            <h2>Volte do ponto certo</h2>
            <p>
              {loading
                ? "Carregando seu último contexto…"
                : resumeJourney?.whereLine
                  ? `${resumeJourney.topicName || resumeTopicShort || "Último tópico"} · ${resumeJourney.whereLine}.`
                  : center?.quickResume?.text || continueHint}
            </p>
            <div className="aprova-dashboard-section__actions">
              <button
                type="button"
                className="aprova-organic-primary-btn"
                onClick={() => onResumeAction?.(resumeJourney?.primaryAction || center?.nextBestStep?.ctaAction || "study_now")}
              >
                Retomar agora
              </button>
            </div>
          </section>

          <section className="aprova-dashboard-section">
            <span className="aprova-profile-section-kicker">O que fazer agora</span>
            <h2>Ações sugeridas</h2>
            <div className="aprova-action-list">
              <button className="aprova-action-row" type="button" onClick={onStudyNow}>
                Abrir leitura guiada
              </button>
              <button className="aprova-action-row" type="button" onClick={onDoQuestions}>
                Fazer questões do tópico
              </button>
              <button className="aprova-action-row" type="button" onClick={() => onResumeAction?.("chat")}>
                Retomar conversa com a Yara
              </button>
            </div>
          </section>

          <section className="aprova-dashboard-section">
            <span className="aprova-profile-section-kicker">Próximos dias</span>
            <h2>Rota sugerida</h2>
            {planLines.length > 0 ? (
              <ul className="aprova-dashboard-route-list">
                {planLines.slice(0, 3).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>
                {loading
                  ? "Gerando roteiro…"
                  : center?.nextBestStep?.text ||
                    suggestion ||
                    "Texto guiado da Yara com a melhor sequência para continuar avançando."}
              </p>
            )}
          </section>
        </div>

        {missionToast?.text ? (
          <div className="aprova-mission-toast" style={styles.missionCompleteToast} role="status">
            {missionToast.text}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const DashboardStudyHub = memo(DashboardStudyHubComponent);
