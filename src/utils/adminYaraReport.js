import {
  createDefaultLearningFeedback,
  inferExplicitLearningFeedback,
  inferImplicitLearningFeedbackFromMessage,
  mergeLearningFeedback,
  normalizeLearningFeedback,
} from "./learningFeedbackLoop.js";
import { buildFullAiPayload } from "./examDate.js";
import { createDefaultStudySessionState, detectUserIntent, updateStudySessionState } from "./studySessionFlow.js";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toList(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR");
}

function uniq(items, limit = 6) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function pushLine(list, condition, text) {
  if (condition && text) list.push(text);
}

function sliceTop(list, limit = 3) {
  return toList(list).slice(0, limit);
}

function buildTopicKey(row) {
  return `${row?.contest_id ?? ""}:${row?.subject_id ?? ""}:${row?.topic_id ?? ""}`;
}

function buildConversationKey(row) {
  return `${row?.user_id ?? ""}:${row?.topic_id ?? ""}`;
}

function aggregateMessageSignals(recentMessages, weakTopics) {
  const topicMap = new Map();
  const conversationMap = new Map();
  const weakTopicMap = new Map(sliceTop(weakTopics, 12).map((row) => [row.topic_id, row]));
  const orderedMessages = [...toList(recentMessages)].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const totals = {
    userMessages: 0,
    assistantMessages: 0,
    stuckMessages: 0,
    confirmationMessages: 0,
    doubtMessages: 0,
    lowConfidenceSessions: 0,
    loopingSessions: 0,
    helpfulSignals: 0,
    notHelpfulSignals: 0,
    wantsPracticeSignals: 0,
    wantsSimplifySignals: 0,
  };

  for (const row of orderedMessages) {
    const topicId = row?.topic_id ?? "";
    const conversationKey = buildConversationKey(row);

    if (!conversationMap.has(conversationKey)) {
      conversationMap.set(conversationKey, {
        sessionState: createDefaultStudySessionState(),
        learningFeedback: createDefaultLearningFeedback(),
      });
    }

    if (!topicMap.has(topicId)) {
      topicMap.set(topicId, {
        topicId,
        contestName: row?.contest_name ?? "",
        subjectName: row?.subject_name ?? "",
        topicName: row?.topic_name ?? "",
        learningFeedback: createDefaultLearningFeedback(),
        sessionState: createDefaultStudySessionState(),
        userMessages: 0,
        assistantMessages: 0,
        sampleUserMessages: [],
      });
    }

    const topicEntry = topicMap.get(topicId);
    const conversationEntry = conversationMap.get(conversationKey);

    if (row?.role === "assistant") {
      totals.assistantMessages += 1;
      topicEntry.assistantMessages += 1;
      continue;
    }

    const message = String(row?.content ?? "");
    const weakTopic = weakTopicMap.get(topicId);
    const intent = detectUserIntent(message);
    const explicitFeedback = inferExplicitLearningFeedback(message);
    const implicitFeedback = inferImplicitLearningFeedbackFromMessage(message, { intent });
    const mergedFeedback = mergeLearningFeedback(conversationEntry.learningFeedback, explicitFeedback, implicitFeedback);
    const nextSessionState = updateStudySessionState(conversationEntry.sessionState, intent, {
      recentErrors: toNumber(weakTopic?.recent_wrong, 0),
      quizAnswered: toNumber(weakTopic?.attempts, 0),
      currentSubTab: toNumber(weakTopic?.attempts, 0) > 0 ? "questions" : "explanation",
    });

    conversationEntry.learningFeedback = mergedFeedback;
    conversationEntry.sessionState = nextSessionState;

    topicEntry.learningFeedback = mergeLearningFeedback(topicEntry.learningFeedback, explicitFeedback, implicitFeedback);
    topicEntry.sessionState = nextSessionState;
    topicEntry.userMessages += 1;
    if (topicEntry.sampleUserMessages.length < 2 && message.trim()) {
      topicEntry.sampleUserMessages.push(message.trim().slice(0, 220));
    }

    totals.userMessages += 1;
    if (intent === "stuck") totals.stuckMessages += 1;
    if (intent === "confirmation") totals.confirmationMessages += 1;
    if (intent === "doubt") totals.doubtMessages += 1;
    if (nextSessionState.confidence === "low") totals.lowConfidenceSessions += 1;
    if (nextSessionState.loopCount >= 2) totals.loopingSessions += 1;

    const normalized = normalizeLearningFeedback(mergedFeedback);
    if (normalized.explanationHelpfulness === "helped") totals.helpfulSignals += 1;
    if (normalized.explanationHelpfulness === "not_helped") totals.notHelpfulSignals += 1;
    if (normalized.preferredNextMove === "practice") totals.wantsPracticeSignals += 1;
    if (normalized.preferredNextMove === "simplify") totals.wantsSimplifySignals += 1;
  }

  return { topicMap, totals };
}

function buildDerivedRiskSignals(weakTopics, topicSignalMap, summary) {
  return sliceTop(weakTopics, 5).map((row) => {
    const topicSignals = topicSignalMap.get(row.topic_id);
    const learningFeedback = normalizeLearningFeedback(topicSignals?.learningFeedback);
    const studySessionContext = topicSignals?.sessionState ?? createDefaultStudySessionState();
    const contest = { id: row.contest_id, name: row.contest_name };
    const subject = { id: row.subject_id, name: row.subject_name };
    const topic = { id: row.topic_id, name: row.topic_name };
    const payload = buildFullAiPayload(
      null,
      contest,
      subject,
      topic,
      {
        questionsAnswered: toNumber(row.attempts, 0),
        questionsCorrect: Math.max(0, toNumber(row.attempts, 0) - toNumber(row.wrong, 0)),
        learningMemory: {
          quizAttemptsInScope: toNumber(summary?.totalAttempts14d, 0),
          currentTopicId: row.topic_id,
          currentTopicQuiz: {
            attempts: toNumber(row.attempts, 0),
            wrong: toNumber(row.wrong, 0),
            accuracyPercent: toNumber(row.accuracy_percent, 0),
          },
          trendLabel: toNumber(row.recent_wrong, 0) >= 2 ? "declining" : "stable",
          weakTopics: sliceTop(weakTopics, 6).map((item) => ({
            topicId: item.topic_id,
            topicName: item.topic_name,
            errors: toNumber(item.wrong, 0),
            attempts: toNumber(item.attempts, 0),
            accuracyPercent: toNumber(item.accuracy_percent, 0),
          })),
          recentWrongHints: toList(topicSignals?.sampleUserMessages).map((message) => ({
            topicName: row.topic_name,
            stemPreview: message,
          })),
        },
      },
      {
        flowMoment: "pre_questions",
        learningFeedback,
        studySessionContext,
      }
    );

    return {
      ...row,
      predictedRisk: payload?.predictedRisk ?? null,
      nextBestAction: payload?.nextBestAction ?? null,
    };
  });
}

function buildMainFrictions(summary, messageTotals, weakTopics, catalogGaps, staleResumeTopics) {
  const lines = [];
  const topWeakTopic = weakTopics[0];
  const topCatalogGap = catalogGaps[0];
  const topResumeGap = staleResumeTopics[0];

  pushLine(
    lines,
    summary.onboardingPending > 0,
    `${pluralize(summary.onboardingPending, "usuario ainda nao concluiu", "usuarios ainda nao concluiram")} o onboarding, o que indica atrito logo na entrada do produto.`
  );
  pushLine(
    lines,
    summary.onboardedWithoutExam > 0,
    `${pluralize(summary.onboardedWithoutExam, "usuario concluiu", "usuarios concluiram")} o onboarding sem concurso principal definido, o que enfraquece a personalizacao inicial da Yara.`
  );
  pushLine(
    lines,
    Boolean(topWeakTopic),
    `O maior ponto de trava hoje aparece em ${topWeakTopic?.contest_name} > ${topWeakTopic?.subject_name} > ${topWeakTopic?.topic_name}, com ${formatPercent(
      topWeakTopic?.accuracy_percent
    )} de acerto e ${pluralize(toNumber(topWeakTopic?.wrong, 0), "erro", "erros")} recentes concentrados.`
  );
  pushLine(
    lines,
    messageTotals.stuckMessages > 0,
    `As conversas recentes mostram ${pluralize(messageTotals.stuckMessages, "sinal claro de travamento", "sinais claros de travamento")} do aluno, com pedidos de reexplicacao e retomada antes da pratica.`
  );
  pushLine(
    lines,
    Boolean(topCatalogGap),
    `Ha catalogo incompleto em ${topCatalogGap?.contest_name}, hoje com ${pluralize(
      toNumber(topCatalogGap?.subject_count, 0),
      "materia",
      "materias"
    )} e ${pluralize(toNumber(topCatalogGap?.topic_count, 0), "topico", "topicos")}, o que fragiliza onboarding e estudo quando esse concurso entra no radar.`
  );
  pushLine(
    lines,
    Boolean(topResumeGap),
    `A retomada tambem merece atencao: ${pluralize(topResumeGap?.users_count ?? 0, "usuario ficou", "usuarios ficaram")} com ultimo foco em ${topResumeGap?.topic_name} sem sinal recente de continuidade.`
  );

  return lines.slice(0, 5);
}

function buildHelpfulPatterns(summary, messageTotals, weakContests, derivedRisks) {
  const lines = [];
  const strongestContest = [...toList(weakContests)].sort((a, b) => {
    return toNumber(b.accuracy_percent, 0) - toNumber(a.accuracy_percent, 0);
  })[0];
  const topAction = derivedRisks
    .map((item) => item?.nextBestAction?.action)
    .filter(Boolean)
    .sort((a, b, arr) => arr.filter((x) => x === b).length - arr.filter((x) => x === a).length)[0];

  pushLine(
    lines,
    messageTotals.confirmationMessages > 0,
    `A Yara mostra sinal de valor quando o aluno chega em confirmacao: foram ${pluralize(
      messageTotals.confirmationMessages,
      "mensagem de entendimento",
      "mensagens de entendimento"
    )} recentes, indicando ganho de clareza em parte das sessoes.`
  );
  pushLine(
    lines,
    messageTotals.helpfulSignals > 0,
    `${pluralize(messageTotals.helpfulSignals, "feedback positivo", "feedbacks positivos")} sugerem que a explicacao funciona melhor quando o aluno chega a pedir comparacao, exemplo ou reforco mais dirigido.`
  );
  pushLine(
    lines,
    Boolean(strongestContest),
    `Entre os concursos com mais uso recente, ${strongestContest?.contest_name} aparece como area relativamente mais solida, com ${formatPercent(
      strongestContest?.accuracy_percent
    )} de acerto medio nas tentativas observadas.`
  );
  pushLine(
    lines,
    Boolean(topAction),
    `O proprio motor de decisao da Yara esta apontando ${topAction} como acao recorrente nos topicos mais sensiveis, o que ajuda a revelar um padrao de intervencao promissor para produto.`
  );

  return lines.slice(0, 4);
}

function buildWeakPatterns(messageTotals, assistantPatterns, derivedRisks) {
  const lines = [];
  const topAssistantPattern = assistantPatterns[0];
  const dominantIntervention = derivedRisks
    .map((item) => item?.predictedRisk?.interventionStyle)
    .filter(Boolean)
    .sort((a, b, arr) => arr.filter((x) => x === b).length - arr.filter((x) => x === a).length)[0];

  pushLine(
    lines,
    messageTotals.notHelpfulSignals > 0,
    `Ainda ha ${pluralize(messageTotals.notHelpfulSignals, "sinal de explicacao pouco efetiva", "sinais de explicacao pouco efetiva")}, especialmente quando o aluno pede simplificacao e continua em baixa confianca.`
  );
  pushLine(
    lines,
    messageTotals.loopingSessions > 0,
    `${pluralize(messageTotals.loopingSessions, "sessao entrou", "sessoes entraram")} em loop de duvida/travamento, o que sugere dificuldade na passagem de explicacao para consolidacao pratica.`
  );
  pushLine(
    lines,
    Boolean(topAssistantPattern),
    `Existe risco de repeticao percebida na fala da Yara: um mesmo padrao de resposta apareceu ${pluralize(
      topAssistantPattern?.occurrences ?? 0,
      "vez",
      "vezes"
    )} e afetou ${pluralize(topAssistantPattern?.users_affected ?? 0, "usuario", "usuarios")}.`
  );
  pushLine(
    lines,
    Boolean(dominantIntervention),
    `Nos topicos mais frageis, a intervencao dominante esta concentrada em ${dominantIntervention}, o que pode indicar dependencia excessiva de um unico tipo de resposta da Yara.`
  );

  return lines.slice(0, 4);
}

function buildTopProductIssues(summary, weakSubjects, catalogGaps, staleResumeTopics) {
  const lines = [];
  const topWeakSubject = weakSubjects[0];
  const topCatalogGap = catalogGaps[0];
  const topResumeGap = staleResumeTopics[0];

  pushLine(
    lines,
    Boolean(topWeakSubject),
    `${topWeakSubject?.subject_name} em ${topWeakSubject?.contest_name} concentra fragilidade relevante, com ${formatPercent(
      topWeakSubject?.accuracy_percent
    )} de acerto medio nas tentativas recentes.`
  );
  pushLine(
    lines,
    Boolean(topCatalogGap) && toNumber(topCatalogGap?.selected_users, 0) > 0,
    `${topCatalogGap?.contest_name} ja aparece no uso real mesmo com arvore incompleta, o que torna a lacuna de catalogo um problema de produto e nao apenas editorial.`
  );
  pushLine(
    lines,
    summary.onboardedWithoutExam > 0,
    "Parte do funil inicial ainda deixa usuario sem prova principal definida, o que enfraquece personalizacao, recomendacao e consistencia da retomada."
  );
  pushLine(
    lines,
    Boolean(topResumeGap),
    `A retomada perde forca quando o usuario para em ${topResumeGap?.topic_name} e nao volta com rapidez, sinal de que o reengajamento ainda pode estar fraco.`
  );

  return lines.slice(0, 4);
}

function buildTopOpportunities(derivedRisks, catalogGaps, selectedContests, messageTotals) {
  const lines = [];
  const topRisk = derivedRisks[0];
  const topSelected = selectedContests[0];
  const topGap = catalogGaps[0];

  pushLine(
    lines,
    Boolean(topRisk?.predictedRisk?.likelyMistake),
    `Ha oportunidade clara de evoluir a Yara nos topicos mais fracos atacando diretamente o erro provavel "${topRisk?.predictedRisk?.likelyMistake}" em ${topRisk?.topic_name}.`
  );
  pushLine(
    lines,
    Boolean(topRisk?.nextBestAction?.action),
    `O motor interno ja sugere o proximo passo mais util em varios casos. Transformar ${topRisk?.nextBestAction?.action} em fluxo mais consistente pode melhorar a taxa de recuperacao.`
  );
  pushLine(
    lines,
    Boolean(topSelected),
    `${topSelected?.catalog_name} e um dos concursos mais escolhidos. Melhorar profundidade e experiencia nele tende a gerar impacto direto na percepcao inicial do produto.`
  );
  pushLine(
    lines,
    Boolean(topGap),
    `Preencher o catalogo de ${topGap?.contest_name} e de outros concursos com baixa densidade de topicos e um ganho rapido para onboarding, estudo e confianca no produto.`
  );
  pushLine(
    lines,
    messageTotals.wantsPracticeSignals > 0,
    `Ha demanda latente por pratica: ${pluralize(
      messageTotals.wantsPracticeSignals,
      "sinal recente pede",
      "sinais recentes pedem"
    )} transicao mais segura para questoes depois da explicacao.`
  );

  return lines.slice(0, 5);
}

function buildSuggestedPriorities(summary, mainFrictions, weakPatterns, topOpportunities) {
  const lines = [];

  pushLine(
    lines,
    mainFrictions.length > 0,
    "Priorizar os 3 topicos com pior combinacao de erro recente + baixa taxa de acerto e reforcar neles o fluxo explicacao -> checagem -> pratica."
  );
  pushLine(
    lines,
    weakPatterns.some((line) => line.includes("repeticao percebida")),
    "Reduzir repeticao nas respostas da Yara, variando mais a forma de orientar e evitando blocos muito parecidos entre assuntos diferentes."
  );
  pushLine(
    lines,
    summary.onboardingPending > 0 || summary.onboardedWithoutExam > 0,
    "Ajustar o onboarding para diminuir abandono e garantir que mais usuarios saiam com concurso principal definido."
  );
  pushLine(
    lines,
    topOpportunities.some((line) => line.includes("catalogo")),
    "Completar primeiro os concursos que ja estao sendo escolhidos ou sugeridos no onboarding e ainda tem arvore rasa."
  );
  pushLine(
    lines,
    true,
    "Usar este relatorio como rotina semanal de lancamento para comparar travas, repeticoes e ganhos de clareza da Yara."
  );

  return lines.slice(0, 5);
}

function buildTextReport(report) {
  const lines = [];
  lines.push("RELATORIO ESTRATEGICO DA YARA");
  lines.push("");
  lines.push(
    `Gerado em ${report.generatedAtLabel}. Base observada: ${pluralize(
      report.summary.totalProfiles,
      "perfil",
      "perfis"
    )}, ${pluralize(report.summary.activeUsers14d, "usuario ativo", "usuarios ativos")} nos ultimos 14 dias, ${pluralize(
      report.summary.totalAttempts14d,
      "tentativa de questao",
      "tentativas de questao"
    )} e acerto medio recente de ${formatPercent(report.summary.accuracy14d)}.`
  );
  lines.push("");

  const sections = [
    ["Principais friccoes observadas", report.mainFrictions],
    ["Sinais do comportamento da Yara", [...report.helpfulPatterns, ...report.weakPatterns].slice(0, 6)],
    ["Problemas de produto percebidos", report.topProductIssues],
    ["Oportunidades de melhoria", report.topOpportunities],
    ["Prioridades recomendadas", report.suggestedPriorities],
  ];

  for (const [title, items] of sections) {
    lines.push(title);
    if (!items.length) {
      lines.push("- Ainda ha pouco sinal para esta secao.");
    } else {
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
    lines.push("");
  }

  if (report.topDerivedRisks.length) {
    lines.push("Leituras mais sensiveis do motor da Yara");
    for (const item of report.topDerivedRisks.slice(0, 3)) {
      const mistake = item?.predictedRisk?.likelyMistake
        ? `Erro provavel: ${item.predictedRisk.likelyMistake}.`
        : "";
      const nextStep = item?.nextBestAction?.action
        ? `Proximo passo sugerido: ${item.nextBestAction.action}.`
        : "";
      lines.push(`- ${item.topic_name} (${item.subject_name} / ${item.contest_name}). ${mistake} ${nextStep}`.trim());
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function buildAdminYaraReport(signals) {
  const summary = {
    totalProfiles: toNumber(signals?.summary?.totalProfiles, 0),
    onboardedProfiles: toNumber(signals?.summary?.onboardedProfiles, 0),
    onboardingPending: toNumber(signals?.summary?.onboardingPending, 0),
    onboardedWithoutExam: toNumber(signals?.summary?.onboardedWithoutExam, 0),
    usersWithResumeSignal: toNumber(signals?.summary?.usersWithResumeSignal, 0),
    activeUsers14d: toNumber(signals?.summary?.activeUsers14d, 0),
    totalVisits14d: toNumber(signals?.summary?.totalVisits14d, 0),
    totalVisits30d: toNumber(signals?.summary?.totalVisits30d, 0),
    totalAttempts14d: toNumber(signals?.summary?.totalAttempts14d, 0),
    wrongAttempts14d: toNumber(signals?.summary?.wrongAttempts14d, 0),
    accuracy14d: toNumber(signals?.summary?.accuracy14d, 0),
  };

  const weakTopics = toList(signals?.weakTopics);
  const weakSubjects = toList(signals?.weakSubjects);
  const weakContests = toList(signals?.weakContests);
  const catalogGaps = toList(signals?.catalogGaps);
  const selectedContests = toList(signals?.selectedContests);
  const staleResumeTopics = toList(signals?.staleResumeTopics);
  const recentMessages = toList(signals?.recentMessages);
  const assistantPatterns = toList(signals?.assistantPatterns);
  const generatedAtLabel = formatDateTime(signals?.generatedAt);

  const { topicMap, totals: messageTotals } = aggregateMessageSignals(recentMessages, weakTopics);
  const topDerivedRisks = buildDerivedRiskSignals(weakTopics, topicMap, summary);

  const mainFrictions = buildMainFrictions(summary, messageTotals, weakTopics, catalogGaps, staleResumeTopics);
  const helpfulPatterns = buildHelpfulPatterns(summary, messageTotals, weakContests, topDerivedRisks);
  const weakPatterns = buildWeakPatterns(messageTotals, assistantPatterns, topDerivedRisks);
  const topProductIssues = buildTopProductIssues(summary, weakSubjects, catalogGaps, staleResumeTopics);
  const topOpportunities = buildTopOpportunities(topDerivedRisks, catalogGaps, selectedContests, messageTotals);
  const suggestedPriorities = buildSuggestedPriorities(summary, mainFrictions, weakPatterns, topOpportunities);

  const report = {
    generatedAtLabel: generatedAtLabel || "agora",
    summary,
    messageTotals,
    mainFrictions,
    helpfulPatterns,
    weakPatterns,
    topProductIssues,
    topOpportunities,
    suggestedPriorities,
    topDerivedRisks,
    supportingSignals: {
      weakTopics: sliceTop(weakTopics, 5),
      weakSubjects: sliceTop(weakSubjects, 5),
      catalogGaps: sliceTop(catalogGaps, 5),
      selectedContests: sliceTop(selectedContests, 5),
      assistantPatterns: sliceTop(assistantPatterns, 5),
    },
  };

  return {
    ...report,
    text: buildTextReport(report),
    copyReadyText: buildTextReport(report),
    sourcesUsed: uniq([
      "profiles",
      "user_topic_visits",
      "topic_question_attempts",
      "topic_messages",
      "contests_catalog",
      "contest_subjects",
      "contest_subject_topics",
      "learningFeedback",
      "studySessionContext",
      "predictedRisk",
      "nextBestAction",
    ]),
  };
}
