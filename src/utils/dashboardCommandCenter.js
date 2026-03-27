function shortText(value, limit = 140) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function pickWeakTopics(learningMemory) {
  return (Array.isArray(learningMemory?.weakTopics) ? learningMemory.weakTopics : [])
    .map((row) => ({
      topicName: typeof row?.topicName === "string" ? row.topicName.trim() : "",
      errors: Math.max(0, Math.floor(Number(row?.errors) || 0)),
      attempts: Math.max(0, Math.floor(Number(row?.attempts) || 0)),
    }))
    .filter((row) => row.topicName)
    .slice(0, 3);
}

function buildRiskPrepLine(examReadiness) {
  if (!examReadiness) {
    return {
      label: "Preparação em leitura",
      tone: "neutral",
      summary: "Complete mais sessões e questões para eu calibrar melhor seu preparo atual.",
    };
  }

  const tone =
    examReadiness.band === "high" ? "positive" : examReadiness.band === "medium" ? "attention" : "warning";
  return {
    label: `${examReadiness.label} · ${examReadiness.score}%`,
    tone,
    summary: shortText(examReadiness.headline || examReadiness.coachHint, 130),
  };
}

export function buildDashboardCommandCenter({
  dashboard,
  examReadiness,
  learnerMemory,
  studyRecommendation,
  studyMission,
  topicErrorInsights,
  examCountdownText,
  lastTopicLabel,
  studyNowHint,
  resumeJourney,
} = {}) {
  const riskPrep = buildRiskPrepLine(examReadiness);
  const weakTopics = pickWeakTopics(learnerMemory);
  const topInsight = Array.isArray(topicErrorInsights) && topicErrorInsights.length ? topicErrorInsights[0] : null;
  const missions = Array.isArray(dashboard?.dailyMissions) ? dashboard.dailyMissions : [];
  const evolutionLines = Array.isArray(dashboard?.evolutionLines) ? dashboard.evolutionLines : [];
  const recentRows = Array.isArray(dashboard?.recentRows) ? dashboard.recentRows : [];

  const weekAttention =
    shortText(
      dashboard?.adaptiveFocusHint ||
        (topInsight?.topic_name
          ? `Ponto de atenção da semana: ${topInsight.topic_name} concentra mais fricção no seu histórico recente.`
          : weakTopics[0]?.topicName
            ? `Ponto de atenção da semana: ${weakTopics[0].topicName} ainda pede reforço.`
            : ""),
      150
    ) || "Sem ponto crítico dominante no momento. Mantenha constância e revisão curta.";

  let nextBestStep = {
    title: "Próximo melhor passo",
    text: "Abra o Estudo e siga a trilha recomendada pela Yara.",
    ctaLabel: "Abrir estudo",
    ctaAction: "open_study_tab",
    emphasis: "Rotina",
  };

  if (studyMission?.topic_name) {
    nextBestStep = {
      title: "Próximo melhor passo",
      text: `Missão guiada em “${studyMission.topic_name}”: revise e transforme esse ponto em acerto hoje.`,
      ctaLabel: "Continuar estudo",
      ctaAction: "study_now",
      emphasis: "Missão",
    };
  } else if (studyRecommendation?.type === "focus" || studyRecommendation?.type === "reinforce") {
    nextBestStep = {
      title: "Próximo melhor passo",
      text: shortText(studyRecommendation.message, 150),
      ctaLabel: "Revisar erros",
      ctaAction: "review_errors",
      emphasis: "Reforço",
    };
  } else if (resumeJourney?.headline || lastTopicLabel || dashboard?.continueProgressLine) {
    nextBestStep = {
      title: "Próximo melhor passo",
      text: shortText(
        resumeJourney?.whyLine ||
          dashboard?.continueProgressLine ||
          `Retome “${lastTopicLabel}” do ponto em que você parou.`,
        150
      ),
      ctaLabel: resumeJourney?.primaryLabel || "Continuar estudo",
      ctaAction: resumeJourney?.primaryAction || "study_now",
      emphasis: resumeJourney?.badgeLabel || resumeJourney?.phaseLabel || "Retomada",
    };
  } else if (dashboard?.suggestedNextTopicName) {
    nextBestStep = {
      title: "Próximo melhor passo",
      text: `Abra “${dashboard.suggestedNextTopicName}”${
        dashboard?.suggestedNextSubjectName ? ` em ${dashboard.suggestedNextSubjectName}` : ""
      } e já encaixe uma rodada curta de questões.`,
      ctaLabel: "Estudar agora",
      ctaAction: "study_now",
      emphasis: "Prioridade",
    };
  }

  const momentVision = {
    title: "Visão do momento",
    headline: examCountdownText || "Seu estudo já tem trilha ativa",
    text: shortText(
      examReadiness?.headline ||
        dashboard?.suggestion ||
        "O Painel está acompanhando seu ritmo, suas revisões e o próximo tópico mais útil.",
      150
    ),
    prepLabel: riskPrep.label,
    prepTone: riskPrep.tone,
    prepSummary: riskPrep.summary,
  };

  const yaraRecommendation = {
    title: "Recomendação da Yara",
    text: shortText(
      studyRecommendation?.message ||
        examReadiness?.bullets?.[0] ||
        dashboard?.suggestion ||
        "Hoje vale combinar uma retomada curta com uma rodada de questões para consolidar o que você já viu.",
      160
    ),
    support: shortText(
      examReadiness?.coachHint ||
        examReadiness?.bullets?.[1] ||
        dashboard?.planLines?.[0] ||
        "",
      150
    ),
  };

  const progressRecent = {
    title: "Progresso recente e pontos frágeis",
    headline: shortText(evolutionLines[0] || "Seu histórico recente começa a mostrar padrões úteis.", 120),
    weakTopics: weakTopics.map((row) =>
      row.attempts > 0 ? `${row.topicName} · ${row.errors} erro(s) em ${row.attempts} tentativa(s)` : row.topicName
    ),
    fallbackWeakLine:
      topInsight?.topic_name
        ? `Fragilidade mais visível agora: ${topInsight.topic_name}.`
        : dashboard?.quizWrong > 0
          ? `${dashboard.quizWrong} erro(s) no quiz já indicam bons pontos para revisão.`
          : "Sem fragilidade dominante aparente: ótimo momento para consolidar com constância.",
  };

  const quickResume = {
    title: "Retomada rápida",
    headline:
      resumeJourney?.headline || (lastTopicLabel ? `Volte para “${lastTopicLabel}”` : "Retome sem perder tempo"),
    text: shortText(
      resumeJourney?.whyLine ||
        dashboard?.continueProgressLine ||
        studyNowHint ||
        (recentRows[0]?.topicName
          ? `Seu último passo foi em “${recentRows[0].topicName}”.`
          : "Abra o próximo tópico sugerido e continue do ponto mais útil para hoje."),
      160
    ),
    whereLine: resumeJourney?.whereLine || "",
    supportLine: resumeJourney?.supportLine || "",
    badgeLabel: resumeJourney?.badgeLabel || "",
    quickActions: Array.isArray(resumeJourney?.quickActions) ? resumeJourney.quickActions : [],
  };

  const missionSnapshot = {
    title: "Missão do dia",
    text:
      missions[0]?.label ||
      "Abra o Estudo e registre pelo menos um bloco de conteúdo e uma rodada curta de questões hoje.",
    progressLabel: missions.length
      ? `${missions.filter((m) => m.done).length}/${missions.length} concluída(s)`
      : "Começar hoje",
  };

  return {
    momentVision,
    nextBestStep,
    missionSnapshot,
    yaraRecommendation,
    progressRecent,
    quickResume,
    weekAttention,
    riskPrep,
  };
}
