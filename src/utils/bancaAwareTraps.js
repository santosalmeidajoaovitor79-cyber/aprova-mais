import { normalizeLearningFeedback } from "./learningFeedbackLoop.js";

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniq(values, limit = 8) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].slice(0, limit);
}

function hasAny(text, parts) {
  return parts.some((part) => text.includes(part));
}

function inferBancaStyle(contestKey) {
  if (hasAny(contestKey, ["cebraspe", "cespe"])) return { bancaStyle: "cebraspe_style", signals: ["contest_cebraspe"] };
  if (hasAny(contestKey, ["fgv", "fundacao getulio vargas"])) {
    return { bancaStyle: "fgv_style", signals: ["contest_fgv"] };
  }
  if (hasAny(contestKey, ["fcc", "carlos chagas"])) {
    return { bancaStyle: "fcc_style", signals: ["contest_fcc"] };
  }
  if (hasAny(contestKey, ["vunesp"])) return { bancaStyle: "vunesp_style", signals: ["contest_vunesp"] };
  if (hasAny(contestKey, ["ibfc", "instituto brasileiro de formacao"])) {
    return { bancaStyle: "ibfc_style", signals: ["contest_ibfc"] };
  }
  return { bancaStyle: "generic_exam_style", signals: ["contest_generic"] };
}

function inferTrapStyle({
  contestKey,
  subjectKey,
  topicKey,
  domainSpecialization,
  likelyMistakeKey,
  interventionStyle,
  feedback,
}) {
  const joined = `${contestKey} ${subjectKey} ${topicKey} ${likelyMistakeKey}`;
  const signals = [];

  if (
    domainSpecialization === "legal_constitutional" ||
    domainSpecialization === "legal_administrative" ||
    hasAny(likelyMistakeKey, ["excecao", "literal", "requisito", "competencia", "instituto"]) ||
    hasAny(joined, ["direito", "constitucional", "administrativo", "lei", "norma"])
  ) {
    signals.push("trap_literal_exception");
    return { trapStyle: "literal_exception_trap", signals };
  }

  if (
    hasAny(likelyMistakeKey, ["sempre", "nunca", "absoluta", "todos", "nenhum", "exclusivamente"]) ||
    hasAny(joined, ["alternativa", "assertiva"]) ||
    hasAny(contestKey, ["fgv", "fcc"])
  ) {
    signals.push("trap_absolute_alternative");
    return { trapStyle: "absolute_alternative_trap", signals };
  }

  if (
    interventionStyle === "exam_trap" &&
    (feedback.confusionSource === "enunciado" ||
      feedback.confusionSource === "alternatives" ||
      hasAny(likelyMistakeKey, ["comando", "criterio", "inverter", "incorreta", "correta"]))
  ) {
    signals.push("trap_wording_inversion");
    return { trapStyle: "wording_inversion_trap", signals };
  }

  if (
    domainSpecialization === "portuguese_interpretation" ||
    hasAny(joined, ["interpretacao", "texto", "leitura", "enunciado"]) ||
    hasAny(likelyMistakeKey, ["enunciado", "alternativa", "comando", "sentido geral"])
  ) {
    signals.push("trap_command_interpretation");
    return { trapStyle: "command_interpretation_trap", signals };
  }

  if (
    domainSpecialization === "math_arithmetic" ||
    domainSpecialization === "math_logical_reasoning" ||
    hasAny(likelyMistakeKey, ["ordem logica", "passo", "sequencia", "sinal", "operacao"]) ||
    hasAny(joined, ["logica", "raciocinio logico", "aritmetica", "calculo", "procedimento"])
  ) {
    signals.push("trap_procedural_order");
    return { trapStyle: "procedural_order_trap", signals };
  }

  if (
    domainSpecialization === "informatics_concepts" ||
    interventionStyle === "contrast_example" ||
    feedback.confusionSource === "concept" ||
    hasAny(likelyMistakeKey, ["conceito", "categoria", "instituto", "diferencia", "funcao"])
  ) {
    signals.push("trap_concept_distractor");
    return { trapStyle: "concept_distractor_trap", signals };
  }

  signals.push("trap_absolute_alternative_fallback");
  return { trapStyle: "absolute_alternative_trap", signals };
}

function buildTrapProfile(trapStyle, bancaStyle) {
  switch (trapStyle) {
    case "literal_exception_trap":
      return {
        alertBias: "alertar para exceção, requisito ou palavra de literalidade que muda a resposta",
        explanationBias: "reforçar a exceção e o detalhe normativo antes do exemplo",
        chatBias: "fazer alerta curto sobre literalidade e exceção antes de prática",
        toneHint: bancaStyle === "cebraspe_style" ? "tom preciso e vigilante com o texto normativo" : "tom preciso e atento à exceção decisiva",
        likelyMistake: "ignorar a exceção ou o requisito literal que a banca costuma usar como armadilha",
      };
    case "absolute_alternative_trap":
      return {
        alertBias: "vigiar alternativas absolutas, generalizações e formulações totalizantes",
        explanationBias: "mostrar o detalhe que desmonta a alternativa absoluta antes de avançar",
        chatBias: "lembrar o aluno de desconfiar de termos absolutos e formulações extremas",
        toneHint: "tom enxuto e estratégico, chamando atenção para exageros da alternativa",
        likelyMistake: "cair em alternativa absoluta e deixar passar a exceção ou nuance decisiva",
      };
    case "wording_inversion_trap":
      return {
        alertBias: "vigiar inversão de comando, polaridade da pergunta e leitura do critério",
        explanationBias: "destacar o verbo de comando e o critério da resposta antes do exemplo",
        chatBias: "fazer alerta curto para reler o que a pergunta realmente pede",
        toneHint: "tom calmo e atento ao comando exato da questão",
        likelyMistake: "inverter o comando da pergunta e marcar a opção certa para o critério errado",
      };
    case "concept_distractor_trap":
      return {
        alertBias: "vigiar distratores que parecem corretos por proximidade conceitual",
        explanationBias: "contrastar conceitos próximos e explicitar o critério de distinção",
        chatBias: "comparar rapidamente as duas ideias mais próximas antes da prática",
        toneHint: "tom comparativo e cirúrgico na diferença entre conceitos",
        likelyMistake: "escolher o distrator mais familiar sem validar o conceito decisivo",
      };
    case "procedural_order_trap":
      return {
        alertBias: "vigiar ordem de passos, conectivos, sinal, sequência ou encadeamento lógico",
        explanationBias: "organizar a solução na ordem correta e reforçar o passo que mais costuma quebrar",
        chatBias: "puxar checagem curta do próximo passo antes de concluir",
        toneHint: "tom progressivo, metódico e orientado por sequência",
        likelyMistake: "trocar a ordem do raciocínio ou pular o passo que decide a resposta",
      };
    default:
      return {
        alertBias: "vigiar interpretação do comando, critério da pergunta e leitura das alternativas",
        explanationBias: "destacar o comando e o critério de leitura antes de mostrar a solução",
        chatBias: "lembrar o aluno de ler o comando e filtrar alternativas pelo critério pedido",
        toneHint: "tom atento ao enunciado e ao critério da banca",
        likelyMistake: "marcar pela impressão geral sem seguir exatamente o comando da questão",
      };
  }
}

export function inferBancaAwareTrap({
  contestName,
  subjectName,
  topicName,
  subjectPedagogy,
  predictedRisk,
  learningFeedback,
} = {}) {
  const contestKey = normalizeText(contestName);
  const subjectKey = normalizeText(subjectName);
  const topicKey = normalizeText(topicName);
  const likelyMistakeKey = normalizeText(predictedRisk?.likelyMistake);
  const feedback = normalizeLearningFeedback(learningFeedback);
  const bancaInfo = inferBancaStyle(contestKey);
  const trapInfo = inferTrapStyle({
    contestKey,
    subjectKey,
    topicKey,
    domainSpecialization: subjectPedagogy?.domainSpecialization ?? "",
    likelyMistakeKey,
    interventionStyle: predictedRisk?.interventionStyle ?? "",
    feedback,
  });
  const profile = buildTrapProfile(trapInfo.trapStyle, bancaInfo.bancaStyle);

  return {
    bancaStyle: bancaInfo.bancaStyle,
    trapStyle: trapInfo.trapStyle,
    alertBias: profile.alertBias,
    explanationBias: profile.explanationBias,
    chatBias: profile.chatBias,
    toneHint: profile.toneHint,
    likelyMistake: profile.likelyMistake,
    reason:
      bancaInfo.bancaStyle === "cebraspe_style"
        ? "há sinais de cobrança com peso maior de literalidade, inversão de comando e leitura fina"
        : bancaInfo.bancaStyle === "fgv_style"
          ? "há sinais de cobrança com distratores fortes, formulações sedutoras e pegadinha de alternativa"
          : bancaInfo.bancaStyle === "fcc_style"
            ? "há sinais de cobrança com distração por detalhe, literalidade e alternativa plausível"
            : "há sinais de cobrança em que vale antecipar a armadilha mais provável do estilo de prova",
    trapSignals: uniq([...bancaInfo.signals, ...trapInfo.signals, ...(feedback.feedbackSignals || []).slice(0, 2)], 8),
  };
}

export function applyBancaAwareTrapToPredictedRisk(predictedRisk, bancaAwareTrap) {
  if (!predictedRisk || typeof predictedRisk !== "object" || !bancaAwareTrap?.trapStyle) {
    return predictedRisk;
  }

  const likelyMistake = predictedRisk.likelyMistake ? predictedRisk.likelyMistake : bancaAwareTrap.likelyMistake;
  const interventionStyle =
    bancaAwareTrap.trapStyle === "concept_distractor_trap"
      ? "contrast_example"
      : bancaAwareTrap.trapStyle === "procedural_order_trap"
        ? predictedRisk.level === "high"
          ? "warning_light"
          : "check_understanding"
        : "exam_trap";

  return {
    ...predictedRisk,
    likelyMistake,
    interventionStyle,
    weakFocus: predictedRisk.weakFocus
      ? `${predictedRisk.weakFocus}; ${bancaAwareTrap.alertBias}`
      : bancaAwareTrap.alertBias,
    reason: predictedRisk.reason
      ? `${predictedRisk.reason}; com alerta preventivo de ${bancaAwareTrap.trapStyle}`
      : bancaAwareTrap.reason,
    bancaStyle: bancaAwareTrap.bancaStyle,
    trapStyle: bancaAwareTrap.trapStyle,
    meta: {
      ...(predictedRisk.meta && typeof predictedRisk.meta === "object" ? predictedRisk.meta : {}),
      bancaStyle: bancaAwareTrap.bancaStyle,
      trapStyle: bancaAwareTrap.trapStyle,
      trapSignals: bancaAwareTrap.trapSignals,
    },
  };
}

export function applyBancaAwareTrapToSubjectPedagogy(subjectPedagogy, bancaAwareTrap) {
  if (!subjectPedagogy || typeof subjectPedagogy !== "object" || !bancaAwareTrap?.trapStyle) {
    return subjectPedagogy;
  }

  return {
    ...subjectPedagogy,
    toneHint: bancaAwareTrap.toneHint || subjectPedagogy.toneHint,
    explanationBias: `${subjectPedagogy.explanationBias}; ${bancaAwareTrap.explanationBias}`,
    chatBias: `${subjectPedagogy.chatBias}; ${bancaAwareTrap.chatBias}`,
    bancaStyle: bancaAwareTrap.bancaStyle,
    trapStyle: bancaAwareTrap.trapStyle,
    trapSignals: bancaAwareTrap.trapSignals,
  };
}
