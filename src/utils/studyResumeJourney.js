function shortText(value, limit = 180) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function daysSinceIso(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((utcNow - utcDate) / 86400000));
}

function safePredictedRisk(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    level:
      raw.level === "low" || raw.level === "medium" || raw.level === "high" ? raw.level : "",
    reason: typeof raw.reason === "string" ? raw.reason.trim() : "",
    likelyMistake: typeof raw.likelyMistake === "string" ? raw.likelyMistake.trim() : "",
    interventionStyle: typeof raw.interventionStyle === "string" ? raw.interventionStyle.trim() : "",
  };
}

function safeNextBestAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    action: typeof raw.action === "string" ? raw.action.trim() : "",
    reason: typeof raw.reason === "string" ? raw.reason.trim() : "",
    flowMoment: typeof raw.flowMoment === "string" ? raw.flowMoment.trim() : "",
  };
}

function safeStudySessionContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    phase: typeof raw.phase === "string" ? raw.phase.trim() : "",
    confidence: typeof raw.confidence === "string" ? raw.confidence.trim() : "",
    lastUserIntent: typeof raw.lastUserIntent === "string" ? raw.lastUserIntent.trim() : "",
    loopCount: Math.max(0, Math.floor(Number(raw.loopCount) || 0)),
  };
}

function inferResumePhase({
  activeStudyTab,
  explanationReady,
  quizTotal,
  quizRevealed,
  quizWrongCount,
  lastStudyUiChat,
  nextBestAction,
  studySessionContext,
}) {
  if (lastStudyUiChat) return "chat";
  if (activeStudyTab === "questions") {
    if (quizWrongCount > 0 && quizRevealed > 0) return "review_errors";
    if (quizTotal > 0 && quizRevealed === 0) return "pre_questions";
    return "questions";
  }
  if (!explanationReady) return "explanation";
  if (
    nextBestAction?.action === "practice_now" ||
    nextBestAction?.action === "summarize_then_practice" ||
    nextBestAction?.action === "give_exam_trap" ||
    nextBestAction?.flowMoment === "post_explanation" ||
    studySessionContext?.phase === "checking"
  ) {
    return "post_explanation";
  }
  return "explanation";
}

function inferResumeTargetTab(resumePhase, activeStudyTab) {
  if (resumePhase === "chat") return "chat";
  if (resumePhase === "questions" || resumePhase === "pre_questions" || resumePhase === "review_errors") {
    return "questions";
  }
  return activeStudyTab === "questions" ? "questions" : "explanation";
}

function inferNextActionFromPhase(resumePhase, nextBestAction) {
  if (resumePhase === "review_errors") return "review_errors";
  if (resumePhase === "pre_questions") return "do_questions";
  if (resumePhase === "chat") return "chat";
  if (nextBestAction?.action === "practice_now" || nextBestAction?.action === "summarize_then_practice") {
    return "do_questions";
  }
  if (nextBestAction?.action === "give_exam_trap") return "do_questions";
  return "study_now";
}

function inferReturnMode(snapshot, context = {}) {
  const daysToExam = Number.isFinite(context?.examCountdownDays) ? context.examCountdownDays : null;
  const recentRows = Array.isArray(context?.recentRows) ? context.recentRows : [];
  const evolutionLines = Array.isArray(context?.evolutionLines) ? context.evolutionLines : [];
  const weakTopics = Array.isArray(context?.weakTopics) ? context.weakTopics : [];
  const examBand = typeof context?.examReadiness?.band === "string" ? context.examReadiness.band : "";
  const examScore = Math.max(0, Math.floor(Number(context?.examReadiness?.score) || 0));
  const predictedRiskLevel = safePredictedRisk(snapshot?.predictedRisk)?.level || "";
  const sessionLoopCount = Math.max(0, Number(snapshot?.studySessionContext?.loopCount) || 0);
  const quizWrongCount = Math.max(0, Number(snapshot?.quizWrongCount) || 0);
  const recentGapDays = daysSinceIso(recentRows[0]?.visitedAt);
  const evolutionBlob = normalizeText(evolutionLines.join(" "));
  const hasOscillationSignal =
    evolutionBlob.includes("taxa") ||
    evolutionBlob.includes("erro") ||
    evolutionBlob.includes("reforco") ||
    evolutionBlob.includes("friccao") ||
    evolutionBlob.includes("oscila");

  if (daysToExam !== null && daysToExam >= 0 && daysToExam <= 21) {
    return "final_stretch";
  }
  if (recentGapDays !== null && recentGapDays >= 6) {
    return "long_break_return";
  }
  if (
    predictedRiskLevel === "high" ||
    quizWrongCount >= 2 ||
    sessionLoopCount >= 2 ||
    weakTopics.length > 0 ||
    hasOscillationSignal ||
    examBand === "low" ||
    (examBand === "medium" && examScore < 65)
  ) {
    return "performance_oscillation";
  }
  return "steady_return";
}

function buildAdaptiveCopy({
  returnMode,
  resumePhase,
  topicName,
  predictedRisk,
  nextBestAction,
  continueProgressLine,
  examCountdownText,
  context,
}) {
  const riskReason = shortText(predictedRisk?.reason, 160);
  const actionReason = shortText(nextBestAction?.reason, 160);
  const weakTopicName =
    Array.isArray(context?.weakTopics) && context.weakTopics[0]?.topicName
      ? String(context.weakTopics[0].topicName).trim()
      : "";
  const fallbackWhy =
    shortText(continueProgressLine || actionReason || riskReason, 190) ||
    "Voltar desse ponto evita recomeçar do zero e mantém o raciocínio do tópico mais fresco.";

  if (returnMode === "final_stretch") {
    return {
      title:
        resumePhase === "review_errors"
          ? `Reta final: feche a revisão em “${topicName}”`
          : `Reta final: retome “${topicName}” com objetivo claro`,
      support: examCountdownText
        ? `${examCountdownText} e este é um ponto que ainda pode render ganho rápido.`
        : "Agora vale voltar com foco em ganho rápido e consolidação.",
      whyLine:
        shortText(
          actionReason ||
            riskReason ||
            `Na reta final, retomar daqui evita dispersão e transforma esse trecho em ponto de prova.`,
          190
        ) || fallbackWhy,
      cta:
        resumePhase === "review_errors"
          ? "Fechar revisão"
          : resumePhase === "pre_questions" || resumePhase === "questions"
            ? "Retomar com foco"
            : "Voltar ao ponto certo",
      badge: "Reta final",
    };
  }

  if (returnMode === "long_break_return") {
    return {
      title: `Volte sem atrito para “${topicName}”`,
      support: "Depois de uma pausa, o melhor retorno é pelo ponto em que o fio do raciocínio ainda pode ser reconstruído rápido.",
      whyLine:
        shortText(
          continueProgressLine ||
            actionReason ||
            `Você não precisa recomeçar tudo: retome daqui, aqueça a memória e avance no mesmo fluxo.`,
          190
        ) || fallbackWhy,
      cta: resumePhase === "chat" ? "Retomar com a Yara" : "Voltar sem recomeçar",
      badge: "Após pausa",
    };
  }

  if (returnMode === "performance_oscillation") {
    return {
      title:
        resumePhase === "review_errors"
          ? `Reencontre estabilidade em “${topicName}”`
          : `Retome “${topicName}” para estabilizar o desempenho`,
      support:
        weakTopicName && weakTopicName !== topicName
          ? `${weakTopicName} e outros sinais recentes pedem retomada mais guiada, sem pular etapa.`
          : "Os sinais recentes pedem uma retomada mais guiada, sem pular etapa.",
      whyLine:
        shortText(
          riskReason ||
            actionReason ||
            `Vale retomar daqui para reduzir a oscilação antes de acelerar para novas questões.`,
          190
        ) || fallbackWhy,
      cta:
        resumePhase === "review_errors"
          ? "Reforçar ponto fraco"
          : resumePhase === "pre_questions"
            ? "Treinar com cuidado"
            : "Retomar com reforço",
      badge: "Oscilação recente",
    };
  }

  return {
    title:
      resumePhase === "chat"
        ? `Volte para a conversa em “${topicName}”`
        : `Retome “${topicName}” do ponto certo`,
    support: "Seu retorno está estável: vale continuar exatamente da etapa que já estava aberta.",
    whyLine: fallbackWhy,
    cta:
      resumePhase === "pre_questions" || resumePhase === "questions"
        ? "Continuar questões"
        : "Continuar estudo",
    badge: "Retorno estável",
  };
}

export function buildStoredStudyResumeMeta({
  activeStudyTab,
  explanationReady,
  quizTotal,
  quizRevealed,
  quizWrongCount,
  lastStudyUiChat,
  studySessionContext,
  predictedRisk,
  nextBestAction,
  lastAssistantActionType,
} = {}) {
  const safeRisk = safePredictedRisk(predictedRisk);
  const safeAction = safeNextBestAction(nextBestAction);
  const safeSession = safeStudySessionContext(studySessionContext);
  const resumePhase = inferResumePhase({
    activeStudyTab,
    explanationReady,
    quizTotal,
    quizRevealed,
    quizWrongCount,
    lastStudyUiChat,
    nextBestAction: safeAction,
    studySessionContext: safeSession,
  });
  const resumeTargetTab = inferResumeTargetTab(resumePhase, activeStudyTab);
  return {
    resumePhase,
    resumeTargetTab,
    quizWrongCount,
    studySessionContext: safeSession,
    predictedRisk: safeRisk,
    nextBestAction: safeAction,
    lastAssistantActionType: typeof lastAssistantActionType === "string" ? lastAssistantActionType.trim() : "",
  };
}

export function buildStudyResumeJourney(snapshot, continueProgressLine = "", context = {}) {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.topicId) return null;
  const topicName = typeof snapshot.topicName === "string" ? snapshot.topicName.trim() : "seu último tópico";
  const subjectName = typeof snapshot.subjectName === "string" ? snapshot.subjectName.trim() : "";
  const resumePhase =
    typeof snapshot.resumePhase === "string" && snapshot.resumePhase.trim()
      ? snapshot.resumePhase.trim()
      : inferResumePhase({
          activeStudyTab: snapshot.activeStudyTab,
          explanationReady: snapshot.explanationReady,
          quizTotal: snapshot.quizTotal,
          quizRevealed: snapshot.quizRevealed,
          quizWrongCount: snapshot.quizWrongCount,
          lastStudyUiChat: snapshot.lastStudyUiChat,
          nextBestAction: snapshot.nextBestAction,
          studySessionContext: snapshot.studySessionContext,
        });
  const targetTab =
    typeof snapshot.resumeTargetTab === "string" && snapshot.resumeTargetTab.trim()
      ? snapshot.resumeTargetTab.trim()
      : inferResumeTargetTab(resumePhase, snapshot.activeStudyTab);
  const nextBestAction = safeNextBestAction(snapshot.nextBestAction);
  const predictedRisk = safePredictedRisk(snapshot.predictedRisk);
  const returnMode = inferReturnMode(snapshot, context);
  const adaptiveCopy = buildAdaptiveCopy({
    returnMode,
    resumePhase,
    topicName,
    predictedRisk,
    nextBestAction,
    continueProgressLine,
    examCountdownText: context?.examCountdownText,
    context,
  });

  let headline = `Retome “${topicName}”`;
  let phaseLabel = "Explicação";
  let primaryAction = "study_now";
  let primaryLabel = "Continuar estudo";

  if (resumePhase === "chat") {
    phaseLabel = "Conversa com a Yara";
    headline = `Volte para a conversa em “${topicName}”`;
    primaryAction = "chat";
    primaryLabel = "Abrir conversa";
  } else if (resumePhase === "pre_questions") {
    phaseLabel = "Pré-questões";
    headline = `Você parou antes das questões em “${topicName}”`;
    primaryAction = "do_questions";
    primaryLabel = "Ir para questões";
  } else if (resumePhase === "review_errors") {
    phaseLabel = "Revisão de erro";
    headline = `Vale revisar os erros em “${topicName}”`;
    primaryAction = "review_errors";
    primaryLabel = "Revisar erros";
  } else if (resumePhase === "post_explanation") {
    phaseLabel = "Pós-explicação";
    headline = `Seu próximo passo em “${topicName}” já está claro`;
    primaryAction = inferNextActionFromPhase(resumePhase, nextBestAction);
    primaryLabel = primaryAction === "do_questions" ? "Ir para questões" : "Continuar estudo";
  } else if (resumePhase === "questions") {
    phaseLabel = "Questões";
    primaryAction = "do_questions";
    primaryLabel = "Voltar às questões";
  }

  if (adaptiveCopy?.title) {
    headline = adaptiveCopy.title;
  }
  if (adaptiveCopy?.cta) {
    primaryLabel = adaptiveCopy.cta;
  }

  const quickActions = [];
  quickActions.push({ id: primaryAction, label: primaryLabel, targetTab, emphasis: "primary" });
  if (primaryAction !== "study_now") quickActions.push({ id: "study_now", label: "Retomar leitura", targetTab: "explanation" });
  if (primaryAction !== "do_questions") quickActions.push({ id: "do_questions", label: "Questões", targetTab: "questions" });
  if (primaryAction !== "chat") quickActions.push({ id: "chat", label: "Yara", targetTab: "chat" });
  if (resumePhase !== "review_errors" && Math.max(0, Number(snapshot.quizWrongCount) || 0) > 0) {
    quickActions.push({ id: "review_errors", label: "Rever erros", targetTab: "questions" });
  }

  return {
    topicId: snapshot.topicId,
    topicName,
    subjectName,
    returnMode,
    phase: resumePhase,
    phaseLabel,
    headline,
    supportLine: adaptiveCopy?.support || "",
    badgeLabel: adaptiveCopy?.badge || "",
    whereLine: subjectName ? `${subjectName} · ${phaseLabel}` : phaseLabel,
    whyLine: adaptiveCopy?.whyLine || "",
    targetTab,
    primaryAction,
    primaryLabel,
    quickActions: quickActions.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index).slice(0, 3),
  };
}
