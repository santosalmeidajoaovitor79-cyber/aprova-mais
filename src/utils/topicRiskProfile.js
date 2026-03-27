import { normalizeLearningFeedback } from "./learningFeedbackLoop.js";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function round2(value) {
  return Math.round(clamp01(value) * 100) / 100;
}

function normalizeTopicId(topicId) {
  return typeof topicId === "string" && topicId.trim() ? topicId.trim() : "";
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqStrings(values, limit = 4) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].slice(0, limit);
}

function pickWeakTopicRow(topicId, learningMemory) {
  const weakTopics = Array.isArray(learningMemory?.weakTopics) ? learningMemory.weakTopics : [];
  return weakTopics.find((row) => {
    const id = typeof row?.topicId === "string" ? row.topicId.trim() : "";
    return Boolean(id) && id === topicId;
  });
}

function pickRecentMistakeHints(learningMemory, weakRow) {
  const hints = Array.isArray(learningMemory?.recentWrongHints) ? learningMemory.recentWrongHints : [];
  const topicName = typeof weakRow?.topicName === "string" ? weakRow.topicName.trim() : "";
  if (!topicName) {
    return hints.slice(0, 2).map((row) => String(row?.stemPreview ?? "").trim()).filter(Boolean);
  }
  const topicNameKey = normalizeText(topicName);
  const scoped = hints
    .filter((row) => normalizeText(row?.topicName).includes(topicNameKey))
    .map((row) => String(row?.stemPreview ?? "").trim())
    .filter(Boolean);
  return (scoped.length ? scoped : hints.map((row) => String(row?.stemPreview ?? "").trim())).slice(0, 2);
}

function inferLikelyMistake({
  recentMistakeTexts,
  weakPatterns,
  trend,
  effectiveAccuracy,
  currentWrong,
}) {
  const combined = normalizeText((recentMistakeTexts || []).join(" "));

  if (
    /\b(exceto|incorreta|correta|errada|assinale|incorreto|marque)\b/.test(combined)
  ) {
    return "confundir o comando do enunciado e inverter o critério da resposta";
  }
  if (/\b(sempre|nunca|jamais|somente|apenas|todos|nenhum|exclusivamente)\b/.test(combined)) {
    return "cair em alternativa muito absoluta e ignorar exceções do tema";
  }
  if (
    /\b(conceito|defin|classific|diferenc|distinc|element|requisit|princip|competenc)\b/.test(
      combined
    )
  ) {
    return "misturar conceitos parecidos e perder o detalhe que diferencia a resposta correta";
  }
  if (/\b(prazo|ordem|sequencia|etapa|proced|passo)\b/.test(combined)) {
    return "trocar a ordem lógica ou o passo decisivo do raciocínio";
  }
  if (weakPatterns.some((row) => row.includes("reincidência de erros"))) {
    return "repetir o mesmo raciocínio que já vinha gerando erro neste tópico";
  }
  if (weakPatterns.some((row) => row.includes("acerto instável"))) {
    return "confundir nuances próximas do conceito e marcar uma alternativa quase certa";
  }
  if (trend === "declining") {
    return "apressar a leitura e perder a palavra ou detalhe que muda a resposta";
  }
  if (currentWrong >= 2 && effectiveAccuracy != null && effectiveAccuracy < 60) {
    return "errar no ponto central do tópico antes de chegar às nuances";
  }
  return "";
}

function inferInterventionStyle(level, likelyMistake, weakPatterns, errorDensity) {
  const text = normalizeText(likelyMistake);
  if (
    /\b(enunciado|criterio|alternativa|absoluta|excecoes|pegadinha|inverter)\b/.test(text)
  ) {
    return "exam_trap";
  }
  if (
    /\b(conceitos parecidos|nuances proximas|diferencia|ordem logica|passo decisivo)\b/.test(text)
  ) {
    return "contrast_example";
  }
  if (weakPatterns.some((row) => row.includes("acerto instável"))) {
    return "check_understanding";
  }
  if (level === "high" && errorDensity >= 0.5) {
    return "contrast_example";
  }
  if (level === "medium") {
    return "check_understanding";
  }
  return "warning_light";
}

function buildMeta({
  recentMistakeTexts,
  weakPatterns,
  trend,
  errorDensity,
  recentErrorWeight,
  effectiveAccuracy,
}) {
  const signalsUsed = [];
  if ((recentMistakeTexts || []).length) signalsUsed.push("recentMistakes");
  if ((weakPatterns || []).length) signalsUsed.push("weakPatterns");
  if (trend) signalsUsed.push("trendLabel");
  if (effectiveAccuracy != null) signalsUsed.push("currentTopicSignals");
  return {
    signalsUsed,
    recentMistakeTexts: uniqStrings(recentMistakeTexts, 2),
    weakPatterns: uniqStrings(weakPatterns, 3),
    trendLabel: trend || "unknown",
    errorDensity,
    recentErrorWeight,
    effectiveAccuracy,
  };
}

function normalizeSessionContext(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      phase: "",
      confidence: "",
      lastUserIntent: "",
      loopCount: 0,
    };
  }
  return {
    phase: typeof raw.phase === "string" ? raw.phase.trim() : "",
    confidence: typeof raw.confidence === "string" ? raw.confidence.trim() : "",
    lastUserIntent: typeof raw.lastUserIntent === "string" ? raw.lastUserIntent.trim() : "",
    loopCount: Math.max(0, Math.min(9, Math.floor(Number(raw.loopCount) || 0))),
  };
}

function normalizeFlowMoment(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return ["explanation", "chat", "pre_questions", "post_explanation"].includes(raw)
    ? raw
    : "chat";
}

/**
 * @param {{
 *   level?: string,
 *   likelyMistake?: string,
 *   interventionStyle?: string,
 *   weakFocus?: string,
 *   reason?: string,
 * } | null | undefined} predictedRisk
 * @param {unknown} studySessionContext
 * @param {string | null | undefined} flowMoment
 * @param {unknown} learningFeedback
 * @param {{ subjectMode?: string, domainSpecialization?: string } | null | undefined} subjectPedagogy
 * @param {{ trapStyle?: string, bancaStyle?: string } | null | undefined} bancaAwareTrap
 */
export function buildNextBestActionPayload(
  predictedRisk,
  studySessionContext,
  flowMoment,
  learningFeedback,
  subjectPedagogy,
  bancaAwareTrap
) {
  const riskLevel =
    predictedRisk?.level === "low" || predictedRisk?.level === "medium" || predictedRisk?.level === "high"
      ? predictedRisk.level
      : "low";
  const likelyMistake =
    typeof predictedRisk?.likelyMistake === "string" ? predictedRisk.likelyMistake.trim() : "";
  const interventionStyle =
    predictedRisk?.interventionStyle === "warning_light" ||
    predictedRisk?.interventionStyle === "contrast_example" ||
    predictedRisk?.interventionStyle === "check_understanding" ||
    predictedRisk?.interventionStyle === "exam_trap"
      ? predictedRisk.interventionStyle
      : "";
  const session = normalizeSessionContext(studySessionContext);
  const moment = normalizeFlowMoment(flowMoment);
  const feedback = normalizeLearningFeedback(learningFeedback);
  const subjectMode = typeof subjectPedagogy?.subjectMode === "string" ? subjectPedagogy.subjectMode : "";
  const domainSpecialization =
    typeof subjectPedagogy?.domainSpecialization === "string"
      ? subjectPedagogy.domainSpecialization
      : "";
  const trapStyle = typeof bancaAwareTrap?.trapStyle === "string" ? bancaAwareTrap.trapStyle : "";

  let action = "explain_core";
  let reason = "construir ou manter a base do tópico antes do próximo passo";

  if (
    trapStyle === "command_interpretation_trap" &&
    (moment === "pre_questions" ||
      feedback.confusionSource === "enunciado" ||
      feedback.confusionSource === "alternatives")
  ) {
    action = "give_exam_trap";
    reason = "o estilo provável de cobrança pede proteger primeiro o comando e o critério da questão";
  } else if (
    trapStyle === "wording_inversion_trap" &&
    (moment === "chat" || moment === "pre_questions")
  ) {
    action = "give_exam_trap";
    reason = "vale antecipar a inversão de comando antes que o aluno pratique no critério errado";
  } else if (
    trapStyle === "procedural_order_trap" &&
    (session.lastUserIntent === "stuck" || session.confidence === "low" || riskLevel !== "low")
  ) {
    action = "recover_foundation";
    reason = "a armadilha provável está na ordem do raciocínio, então vale reconstruir os passos";
  } else if (
    trapStyle === "concept_distractor_trap" &&
    (feedback.confusionSource === "concept" || interventionStyle === "contrast_example")
  ) {
    action = "contrast_concepts";
    reason = "a banca parece cobrar por distrator conceitual, então o melhor passo é contrastar as ideias";
  } else if (
    trapStyle === "absolute_alternative_trap" &&
    (moment === "pre_questions" || moment === "post_explanation")
  ) {
    action = "check_understanding";
    reason = "vale uma checagem curta para evitar cair em alternativa absoluta antes de avançar";
  } else if (
    trapStyle === "literal_exception_trap" &&
    (moment === "pre_questions" || interventionStyle === "exam_trap")
  ) {
    action = "give_exam_trap";
    reason = "a cobrança provável parece girar em torno de exceção e literalidade, então cabe alerta preventivo";
  } else if (
    domainSpecialization === "portuguese_interpretation" &&
    (feedback.confusionSource === "enunciado" ||
      feedback.confusionSource === "alternatives" ||
      moment === "pre_questions")
  ) {
    action = "give_exam_trap";
    reason = "em interpretação vale proteger o comando, o critério e o distrator mais sedutor antes de avançar";
  } else if (
    domainSpecialization === "portuguese_grammar" &&
    (feedback.studentConfidence === "low" || riskLevel === "high")
  ) {
    action = "recover_foundation";
    reason = "em gramática costuma render mais retomar a regra base e a exceção antes de testar";
  } else if (
    domainSpecialization === "math_arithmetic" &&
    (session.lastUserIntent === "stuck" || session.confidence === "low" || riskLevel !== "low")
  ) {
    action = "recover_foundation";
    reason = "em aritmética vale reconstruir a conta passo a passo antes de acelerar";
  } else if (
    domainSpecialization === "math_logical_reasoning" &&
    (session.lastUserIntent === "stuck" || riskLevel === "high")
  ) {
    action = "recover_foundation";
    reason = "em raciocínio lógico o melhor passo é refazer o elo inferencial antes de praticar";
  } else if (
    domainSpecialization === "informatics_commands" &&
    moment === "pre_questions" &&
    riskLevel !== "high"
  ) {
    action = "summarize_then_practice";
    reason = "em comandos e atalhos, uma síntese operacional curta costuma preparar melhor a prática";
  } else if (
    domainSpecialization === "informatics_concepts" &&
    (feedback.confusionSource === "concept" || interventionStyle === "contrast_example")
  ) {
    action = "contrast_concepts";
    reason = "em informática conceitual costuma ajudar comparar função, categoria e uso de cada conceito";
  } else if (
    (domainSpecialization === "legal_constitutional" || domainSpecialization === "legal_administrative") &&
    (interventionStyle === "exam_trap" || interventionStyle === "contrast_example")
  ) {
    action = moment === "pre_questions" ? "give_exam_trap" : "contrast_concepts";
    reason =
      moment === "pre_questions"
        ? "nesse domínio jurídico vale antecipar a exceção, a competência ou o requisito decisivo antes da prática"
        : "nesse domínio jurídico costuma ajudar contrastar institutos e destacar a distinção normativa central";
  } else if (
    subjectMode === "reading_interpretation" &&
    (feedback.confusionSource === "enunciado" ||
      feedback.confusionSource === "alternatives" ||
      moment === "pre_questions")
  ) {
    action = "give_exam_trap";
    reason = "neste tipo de conteúdo vale proteger a leitura do comando e das alternativas antes do próximo passo";
  } else if (
    subjectMode === "logical_procedural" &&
    (session.lastUserIntent === "stuck" || session.confidence === "low" || riskLevel === "high")
  ) {
    action = "recover_foundation";
    reason = "este conteúdo pede reconstrução do passo a passo antes de acelerar";
  } else if (
    subjectMode === "conceptual_compare" &&
    (feedback.confusionSource === "concept" || interventionStyle === "contrast_example")
  ) {
    action = "contrast_concepts";
    reason = "este tipo de tópico tende a render mais quando a diferença entre conceitos fica explícita";
  } else if (
    subjectMode === "legal_literal" &&
    (interventionStyle === "exam_trap" || interventionStyle === "contrast_example")
  ) {
    action = moment === "pre_questions" ? "give_exam_trap" : "contrast_concepts";
    reason =
      moment === "pre_questions"
        ? "em tema jurídico vale antecipar a exceção ou a leitura literal antes da prática"
        : "em tema jurídico costuma ajudar contrastar institutos e destacar a exceção decisiva";
  } else if (
    subjectMode === "memorization_precision" &&
    moment === "explanation" &&
    riskLevel !== "high"
  ) {
    action = "summarize_then_practice";
    reason = "este conteúdo costuma render melhor com síntese curta e reforço do detalhe crítico";
  } else if (feedback.preferredNextMove === "review_base" || feedback.explanationHelpfulness === "not_helped") {
    action = "recover_foundation";
    reason = "o feedback recente indica que a base ainda não assentou bem";
  } else if (feedback.confusionSource === "enunciado" || feedback.confusionSource === "alternatives") {
    action = "give_exam_trap";
    reason = "o feedback sugere dificuldade na leitura do enunciado ou nas alternativas";
  } else if (feedback.preferredNextMove === "contrast" || feedback.confusionSource === "concept") {
    action = "contrast_concepts";
    reason = "o feedback aponta que comparar e diferenciar conceitos deve ajudar mais agora";
  } else if (feedback.preferredNextMove === "practice" && riskLevel !== "high" && feedback.studentConfidence !== "low") {
    action = "practice_now";
    reason = "o aluno sinalizou abertura para praticar e o contexto permite avançar";
  } else if (feedback.preferredNextMove === "simplify") {
    action = "recover_foundation";
    reason = "o aluno pediu simplificação, então vale consolidar a base antes de avançar";
  } else if (
    riskLevel === "high" &&
    (session.lastUserIntent === "stuck" || session.confidence === "low" || session.phase === "learning")
  ) {
    action = "recover_foundation";
    reason = "há risco alto com sinais de base frágil ou travamento no tópico";
  } else if (interventionStyle === "exam_trap" && (moment === "pre_questions" || moment === "chat")) {
    action = "give_exam_trap";
    reason = likelyMistake
      ? `o próximo melhor passo é prevenir a pegadinha provável: ${likelyMistake}`
      : "o momento pede um alerta curto de pegadinha antes da prática";
  } else if (
    interventionStyle === "contrast_example" ||
    /conceit|nuance|diferencia|ordem logica|passo decisivo/.test(normalizeText(likelyMistake))
  ) {
    action = "contrast_concepts";
    reason = likelyMistake
      ? `o erro provável pede contraste didático: ${likelyMistake}`
      : "o próximo melhor passo é contrastar conceitos próximos antes de avançar";
  } else if (
    session.phase === "checking" ||
    session.lastUserIntent === "confirmation" ||
    interventionStyle === "check_understanding" ||
    feedback.preferredNextMove === "example"
  ) {
    action = "check_understanding";
    reason = "o contexto indica que vale validar entendimento antes de aprofundar ou praticar";
  } else if (
    (moment === "post_explanation" || moment === "explanation") &&
    (riskLevel === "low" || (riskLevel === "medium" && session.confidence === "high"))
  ) {
    action = "summarize_then_practice";
    reason = "o aluno já pode fechar a ideia central e seguir para prática sem excesso de teoria";
  } else if (
    moment === "pre_questions" &&
    riskLevel !== "high" &&
    session.lastUserIntent !== "stuck" &&
    session.loopCount < 3
  ) {
    action = "practice_now";
    reason = "o melhor próximo movimento é praticar agora, sem prolongar teoria além do necessário";
  } else if (moment === "explanation") {
    action = riskLevel === "high" ? "recover_foundation" : "explain_core";
    reason =
      riskLevel === "high"
        ? "a explicação deve consolidar a base antes do exemplo e da prática"
        : "o próximo passo é explicar o núcleo do tópico com clareza e progressão";
  }

  return {
    action,
    reason,
    flowMoment: moment,
  };
}

function countRecentTopicVisits(topicId, learningMemory) {
  const recentStudyTopics = Array.isArray(learningMemory?.recentStudyTopics)
    ? learningMemory.recentStudyTopics
    : [];
  return recentStudyTopics.filter((row) => {
    const id = typeof row?.topicId === "string" ? row.topicId.trim() : "";
    return id === topicId;
  }).length;
}

/**
 * Perfil bruto de risco para antecipar erro provável antes da prática.
 * @param {string | null | undefined} topicId
 * @param {Record<string, unknown> | null | undefined} learningMemory
 * @param {{ total?: number, wrong?: number, accuracyPercent?: number | null } | null | undefined} topicStats
 * @returns {{
 *   riskLevel: "low" | "medium" | "high",
 *   weakPatterns: string[],
 *   errorDensity: number,
 *   recentErrorWeight: number,
 *   likelyMistake: string,
 *   interventionStyle: "warning_light" | "contrast_example" | "check_understanding" | "exam_trap",
 *   meta: Record<string, unknown>,
 * }}
 */
export function buildTopicRiskProfile(topicId, learningMemory, topicStats) {
  const tid = normalizeTopicId(topicId);
  if (!tid) {
    return {
      riskLevel: "low",
      weakPatterns: [],
      errorDensity: 0,
      recentErrorWeight: 0,
      likelyMistake: "",
      interventionStyle: "warning_light",
      meta: {
        signalsUsed: [],
        recentMistakeTexts: [],
        weakPatterns: [],
        trendLabel: "unknown",
        errorDensity: 0,
        recentErrorWeight: 0,
        effectiveAccuracy: null,
      },
    };
  }

  const total = Math.max(0, Math.floor(Number(topicStats?.total) || 0));
  const wrong = Math.max(0, Math.floor(Number(topicStats?.wrong) || 0));
  const accuracyPercentRaw =
    topicStats?.accuracyPercent == null ? null : Math.round(Number(topicStats.accuracyPercent));
  const accuracyPercent =
    accuracyPercentRaw != null && Number.isFinite(accuracyPercentRaw)
      ? Math.min(100, Math.max(0, accuracyPercentRaw))
      : null;

  const weakRow = pickWeakTopicRow(tid, learningMemory);
  const recentMistakeTexts = pickRecentMistakeHints(learningMemory, weakRow);
  const recentVisits = countRecentTopicVisits(tid, learningMemory);
  const trend = learningMemory?.trendLabel;
  const currentTopicQuiz =
    learningMemory?.currentTopicId === tid && learningMemory?.currentTopicQuiz
      ? learningMemory.currentTopicQuiz
      : null;

  const currentAttempts = Math.max(
    total,
    Math.floor(Number(currentTopicQuiz?.attempts) || 0)
  );
  const currentWrong = Math.max(wrong, Math.floor(Number(currentTopicQuiz?.wrong) || 0));
  const effectiveAccuracy =
    accuracyPercent != null
      ? accuracyPercent
      : currentAttempts > 0
        ? Math.round(((currentAttempts - currentWrong) / currentAttempts) * 100)
        : null;

  const errorDensity =
    currentAttempts > 0 ? round2(currentWrong / Math.max(1, currentAttempts)) : 0;

  let recentErrorWeight = 0;
  if (weakRow) {
    const weakAttempts = Math.max(0, Math.floor(Number(weakRow.attempts) || 0));
    const weakErrors = Math.max(0, Math.floor(Number(weakRow.errors) || 0));
    const weakDensity = weakAttempts > 0 ? weakErrors / weakAttempts : 0;
    recentErrorWeight = Math.max(recentErrorWeight, weakDensity);
    if (weakErrors >= 4) recentErrorWeight += 0.18;
    else if (weakErrors >= 2) recentErrorWeight += 0.1;
  }
  if (trend === "declining") recentErrorWeight += 0.14;
  else if (trend === "stable") recentErrorWeight += 0.04;
  if (recentVisits >= 3) recentErrorWeight += 0.12;
  else if (recentVisits >= 2) recentErrorWeight += 0.07;
  recentErrorWeight = round2(recentErrorWeight);

  const weakPatterns = [];
  if (effectiveAccuracy != null && currentAttempts >= 2 && effectiveAccuracy < 55) {
    weakPatterns.push("baixa taxa de acerto neste tópico");
  } else if (effectiveAccuracy != null && currentAttempts >= 2 && effectiveAccuracy < 70) {
    weakPatterns.push("acerto instável neste tópico");
  }
  if (currentWrong >= 3) {
    weakPatterns.push("reincidência de erros no mesmo tópico");
  } else if (currentWrong >= 1 && currentAttempts >= 2) {
    weakPatterns.push("sinais recentes de confusão");
  }
  if (recentVisits >= 3) {
    weakPatterns.push("repetição recente sem consolidação clara");
  }
  if (trend === "declining") {
    weakPatterns.push("tendência recente de queda no quiz");
  }

  const score =
    errorDensity * 0.48 +
    recentErrorWeight * 0.32 +
    (effectiveAccuracy != null ? clamp01((72 - effectiveAccuracy) / 40) * 0.2 : 0);

  const riskLevel = score >= 0.66 ? "high" : score >= 0.36 ? "medium" : "low";
  const likelyMistake = inferLikelyMistake({
    recentMistakeTexts,
    weakPatterns,
    trend,
    effectiveAccuracy,
    currentWrong,
  });
  const interventionStyle = inferInterventionStyle(
    riskLevel,
    likelyMistake,
    weakPatterns,
    errorDensity
  );
  const meta = buildMeta({
    recentMistakeTexts,
    weakPatterns,
    trend,
    errorDensity,
    recentErrorWeight,
    effectiveAccuracy,
  });

  return {
    riskLevel,
    weakPatterns: weakPatterns.slice(0, 3),
    errorDensity,
    recentErrorWeight,
    likelyMistake,
    interventionStyle,
    meta,
  };
}

function resolveFeedbackAdjustedInterventionStyle(baseStyle, learningFeedback) {
  const feedback = normalizeLearningFeedback(learningFeedback);
  if (feedback.confusionSource === "enunciado" || feedback.confusionSource === "alternatives") {
    return "exam_trap";
  }
  if (feedback.confusionSource === "concept" || feedback.preferredNextMove === "contrast") {
    return "contrast_example";
  }
  if (feedback.preferredNextMove === "simplify" || feedback.explanationHelpfulness === "not_helped") {
    return "warning_light";
  }
  if (feedback.preferredNextMove === "practice" && feedback.studentConfidence !== "low") {
    return "check_understanding";
  }
  return baseStyle;
}

/**
 * Resumo curto e seguro para entrar no payload da IA.
 * @param {string | null | undefined} topicId
 * @param {Record<string, unknown> | null | undefined} learningMemory
 * @param {{ total?: number, wrong?: number, accuracyPercent?: number | null } | null | undefined} topicStats
 * @param {{ band?: string | null } | null | undefined} examReadiness
 * @param {unknown} [learningFeedback]
 */
export function buildPredictedRiskPayload(topicId, learningMemory, topicStats, examReadiness, learningFeedback) {
  const profile = buildTopicRiskProfile(topicId, learningMemory, topicStats);
  const focusSignals = profile.weakPatterns.slice(0, 2);
  const focus = focusSignals.join("; ");
  const hasTopicStats =
    topicStats &&
    typeof topicStats === "object" &&
    (Number.isFinite(Number(topicStats.total)) || Number.isFinite(Number(topicStats.accuracyPercent)));

  let level = profile.riskLevel;
  if (level === "medium" && examReadiness?.band === "low" && profile.errorDensity >= 0.45) {
    level = "high";
  }
  if (!learningMemory && hasTopicStats && level === "low" && examReadiness?.band === "low") {
    level = profile.errorDensity >= 0.34 ? "medium" : "low";
  }

  const reason =
    level === "high"
      ? focusSignals[0] || "há sinais fortes de erro recorrente neste tópico"
      : level === "medium"
        ? focusSignals[0] ||
          (!learningMemory && hasTopicStats
            ? "há sinais moderados no desempenho recente deste tópico"
            : "há sinais moderados de tropeço neste tópico")
        : focusSignals[0] || "base aparentemente estável neste tópico";
  const interventionStyle = resolveFeedbackAdjustedInterventionStyle(
    profile.interventionStyle,
    learningFeedback
  );

  return {
    level,
    reason,
    weakFocus: focus,
    likelyMistake: profile.likelyMistake,
    interventionStyle,
    meta: profile.meta,
    profile,
  };
}
