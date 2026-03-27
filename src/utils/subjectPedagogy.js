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

function hasAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

const GENERAL_MODE_PROFILES = {
  legal_literal: {
    pedagogyBias: "priorizar literalidade, contraste entre institutos e pegadinhas de exceção",
    toneHint: "tom preciso, claro e atento a detalhes normativos e exceções",
    explanationBias: "realçar requisitos, distinções e a palavra que muda o sentido jurídico",
    chatBias: "usar contraste curto, literalidade e alerta de exceção quando fizer sentido",
    likelyMistake: "ignorar uma exceção, requisito ou detalhe de literalidade que muda a resposta",
    weakFocusHint: "literalidade, exceções e distinção entre institutos",
  },
  logical_procedural: {
    pedagogyBias: "priorizar ordem de raciocínio, sequência de passos e checagem curta",
    toneHint: "tom progressivo, organizado e orientado por etapas",
    explanationBias: "explicar o passo base antes da variação e validar a sequência lógica",
    chatBias: "quebrar em passos, reconstruir base e checar o próximo elo do raciocínio",
    likelyMistake: "pular uma etapa do raciocínio e quebrar a ordem lógica da solução",
    weakFocusHint: "ordem do raciocínio e passo decisivo",
  },
  conceptual_compare: {
    pedagogyBias: "priorizar contraste de conceitos próximos e diferença decisiva entre ideias",
    toneHint: "tom comparativo, didático e focado em diferenciação",
    explanationBias: "contrastar definições, nuances e critérios de distinção",
    chatBias: "comparar ideias vizinhas antes de aprofundar ou praticar",
    likelyMistake: "misturar conceitos próximos e perder o critério que diferencia a resposta correta",
    weakFocusHint: "contraste entre conceitos próximos",
  },
  reading_interpretation: {
    pedagogyBias: "priorizar leitura cuidadosa do comando, critério do enunciado e leitura de alternativas",
    toneHint: "tom calmo, atento ao comando e à leitura cuidadosa",
    explanationBias: "destacar verbo de comando, critério de resposta e armadilhas de leitura",
    chatBias: "alertar sobre leitura do enunciado e distratores antes de acelerar para prática",
    likelyMistake: "ler rápido o comando do enunciado e marcar uma alternativa pelo sentido geral",
    weakFocusHint: "comando do enunciado e leitura das alternativas",
  },
  memorization_precision: {
    pedagogyBias: "priorizar precisão de detalhe, classificação e revisão curta de memória",
    toneHint: "tom direto, enxuto e focado em detalhe crítico",
    explanationBias: "realçar o detalhe que diferencia opções e sintetizar pontos de revisão",
    chatBias: "usar síntese curta, precisão terminológica e lembrete de detalhe-chave",
    likelyMistake: "trocar um detalhe de classificação, prazo, termo técnico ou item de memória",
    weakFocusHint: "detalhe crítico, classificação e precisão terminológica",
  },
};

const DOMAIN_PROFILES = {
  legal_constitutional: {
    subjectMode: "legal_literal",
    pedagogyBias: "priorizar princípios, competências, direitos fundamentais e exceções constitucionais",
    toneHint: "tom preciso, normativo e comparativo entre competências, princípios e garantias",
    explanationBias: "destacar literalidade constitucional, distinções entre competências e a exceção que muda o caso",
    chatBias: "comparar institutos constitucionais próximos e alertar sobre a palavra-chave do texto normativo",
    likelyMistake: "misturar competência, princípio ou exceção constitucional e inverter a conclusão da questão",
    weakFocusHint: "competência, literalidade constitucional e exceções relevantes",
    reason: "há sinais de conteúdo constitucional com peso forte de literalidade, competência e exceção",
  },
  legal_administrative: {
    subjectMode: "legal_literal",
    pedagogyBias: "priorizar requisitos do ato, poderes administrativos, agentes, princípios e distinções de regime",
    toneHint: "tom objetivo, técnico e atento a requisitos, atributos e limites da Administração",
    explanationBias: "explicar requisito, atributo ou limite antes de contrastar institutos administrativos próximos",
    chatBias: "usar contraste entre ato, poder, agente ou responsabilidade antes de partir para prática",
    likelyMistake: "confundir atributo, requisito ou regime jurídico de institutos administrativos parecidos",
    weakFocusHint: "atributos, requisitos, poderes e distinções de regime",
    reason: "há sinais de conteúdo administrativo com peso maior de institutos, atributos e limites",
  },
  portuguese_grammar: {
    subjectMode: "memorization_precision",
    pedagogyBias: "priorizar regra, exceção, classe gramatical, sintaxe e detalhe linguístico decisivo",
    toneHint: "tom claro, analítico e atento à regra que governa o caso",
    explanationBias: "explicar a regra base, a exceção e o contraste entre construções próximas",
    chatBias: "relembrar a regra curta, contrastar exemplos e testar o detalhe gramatical crítico",
    likelyMistake: "aplicar a regra certa no lugar errado ou ignorar a exceção gramatical que muda a resposta",
    weakFocusHint: "regra gramatical, exceção e detalhe sintático ou morfológico",
    reason: "há sinais de gramática com peso forte de regra, exceção e precisão linguística",
  },
  portuguese_interpretation: {
    subjectMode: "reading_interpretation",
    pedagogyBias: "priorizar comando do enunciado, intenção do texto, inferência e leitura das alternativas",
    toneHint: "tom calmo, guiado pela leitura do texto e pelo critério da pergunta",
    explanationBias: "destacar o verbo de comando, o foco interpretativo e o distrator mais provável",
    chatBias: "pedir leitura cuidadosa do comando e mostrar por que a alternativa sedutora não atende ao critério",
    likelyMistake: "marcar a alternativa mais plausível em geral sem checar o que o comando realmente pede",
    weakFocusHint: "comando, inferência e leitura fina das alternativas",
    reason: "há sinais de interpretação de texto com peso maior de comando, inferência e distrator",
  },
  math_arithmetic: {
    subjectMode: "logical_procedural",
    pedagogyBias: "priorizar ordem de operações, unidade, proporção, cálculo base e checagem de resultado",
    toneHint: "tom organizado, objetivo e passo a passo",
    explanationBias: "montar a conta em etapas e verificar o detalhe operacional que costuma escapar",
    chatBias: "quebrar o cálculo em passos curtos e checar sinal, unidade ou operação antes de avançar",
    likelyMistake: "errar a ordem da conta, o sinal ou a transformação numérica antes de chegar ao resultado",
    weakFocusHint: "ordem de operações, sinal, unidade e transformação numérica",
    reason: "há sinais de aritmética com peso maior de operação, unidade e verificação de cálculo",
  },
  math_logical_reasoning: {
    subjectMode: "logical_procedural",
    pedagogyBias: "priorizar encadeamento lógico, condição, equivalência, negação e checagem do passo inferencial",
    toneHint: "tom metódico, progressivo e atento ao elo lógico",
    explanationBias: "reconstruir a cadeia lógica antes de testar a conclusão",
    chatBias: "validar premissa, conectivo ou negação antes de aceitar a conclusão",
    likelyMistake: "quebrar a cadeia inferencial, negar errado ou trocar a equivalência lógica decisiva",
    weakFocusHint: "encadeamento lógico, conectivos, negação e equivalência",
    reason: "há sinais de raciocínio lógico com peso maior de conectivos, inferência e sequência lógica",
  },
  informatics_concepts: {
    subjectMode: "conceptual_compare",
    pedagogyBias: "priorizar contraste entre conceitos de hardware, software, redes, segurança e organização de sistemas",
    toneHint: "tom claro, comparativo e orientado a categorias e funções",
    explanationBias: "diferenciar conceito, função e categoria antes de aprofundar detalhe técnico",
    chatBias: "comparar termos parecidos e mostrar a função prática de cada conceito",
    likelyMistake: "confundir conceitos de informática parecidos e escolher pela familiaridade do termo",
    weakFocusHint: "categoria, função e diferença entre conceitos técnicos próximos",
    reason: "há sinais de informática conceitual com peso maior de categorias, funções e distinções",
  },
  informatics_commands: {
    subjectMode: "memorization_precision",
    pedagogyBias: "priorizar comando, sintaxe, atalho, localização de opção e detalhe operacional",
    toneHint: "tom direto, operacional e preciso",
    explanationBias: "mostrar o comando ou caminho correto e o detalhe de sintaxe que mais gera erro",
    chatBias: "reforçar comando, atalho ou caminho de menu com checagem curta antes da prática",
    likelyMistake: "trocar comando, sintaxe, atalho ou caminho operacional por outro muito parecido",
    weakFocusHint: "comando, sintaxe, atalho e caminho operacional",
    reason: "há sinais de informática operacional com peso maior de comando, sintaxe e execução",
  },
};

function isGenericLikelyMistake(text) {
  return (
    !text ||
    /mesmo raciocinio|ponto central|nuances|quase certa|detalhe que diferencia|errar no ponto central/.test(
      text
    )
  );
}

function inferDomainSpecialization({
  subjectKey,
  topicKey,
  likelyMistakeKey,
  interventionStyle,
  feedback,
  weakFocusKey,
  reasonKey,
}) {
  const joined = `${subjectKey} ${topicKey} ${likelyMistakeKey} ${weakFocusKey} ${reasonKey}`;
  const signals = [];

  if (
    hasAny(joined, [
      "constitucional",
      "constituicao",
      "direitos fundamentais",
      "organizacao do estado",
      "organizacao dos poderes",
      "controle de constitucionalidade",
      "remedios constitucionais",
      "poder constituinte",
      "competencia constitucional",
    ])
  ) {
    signals.push("domain_legal_constitutional");
    return { domainSpecialization: "legal_constitutional", signals };
  }

  if (
    hasAny(joined, [
      "administrativo",
      "ato administrativo",
      "agentes publicos",
      "licit",
      "contratos administrativos",
      "poder de policia",
      "improbidade",
      "servicos publicos",
      "responsabilidade civil do estado",
      "bens publicos",
      "controle da administracao",
      "poderes administrativos",
    ])
  ) {
    signals.push("domain_legal_administrative");
    return { domainSpecialization: "legal_administrative", signals };
  }

  if (
    hasAny(joined, [
      "portugues",
      "lingua portuguesa",
      "gramatica",
      "morfologia",
      "sintaxe",
      "regencia",
      "crase",
      "concordancia",
      "pontuacao",
      "acentuacao",
      "ortografia",
      "semantica",
      "classes de palavras",
      "analise sintatica",
    ]) ||
    hasAny(likelyMistakeKey, ["regra", "crase", "concord", "regencia", "pontu", "acentu"])
  ) {
    signals.push("domain_portuguese_grammar");
    return { domainSpecialization: "portuguese_grammar", signals };
  }

  if (
    hasAny(joined, [
      "interpretacao",
      "compreensao",
      "texto",
      "leitura",
      "analise textual",
      "tipologia textual",
      "inferencia",
      "coesao",
      "coerencia",
    ]) ||
    feedback.confusionSource === "enunciado" ||
    feedback.confusionSource === "alternatives" ||
    hasAny(likelyMistakeKey, ["enunciado", "alternativa", "comando", "criterio"])
  ) {
    signals.push("domain_portuguese_interpretation");
    return { domainSpecialization: "portuguese_interpretation", signals };
  }

  if (
    hasAny(joined, [
      "matematica",
      "aritmetica",
      "porcentagem",
      "fracao",
      "fracoes",
      "razao",
      "proporcao",
      "regra de tres",
      "juros",
      "mdc",
      "mmc",
      "equacao",
      "unidade",
    ]) ||
    hasAny(likelyMistakeKey, ["sinal", "ordem da conta", "transformacao numerica", "operacao"])
  ) {
    signals.push("domain_math_arithmetic");
    return { domainSpecialization: "math_arithmetic", signals };
  }

  if (
    hasAny(joined, [
      "logica",
      "raciocinio logico",
      "proposicoes",
      "conectivos",
      "negacao",
      "equivalencia",
      "argumentacao logica",
      "sequencias logicas",
      "tabela verdade",
      "condicional",
      "bicondicional",
    ]) ||
    hasAny(likelyMistakeKey, ["ordem logica", "passo decisivo", "sequencia", "negar errado", "equivalencia"]) ||
    interventionStyle === "check_understanding"
  ) {
    signals.push("domain_math_logical_reasoning");
    return { domainSpecialization: "math_logical_reasoning", signals };
  }

  if (
    hasAny(joined, [
      "informatica",
      "hardware",
      "software",
      "sistema operacional",
      "redes",
      "seguranca da informacao",
      "internet",
      "banco de dados",
      "memoria",
      "armazenamento",
      "conceitos basicos de informatica",
    ]) &&
    !hasAny(joined, [
      "comando",
      "atalho",
      "cmd",
      "powershell",
      "terminal",
      "prompt",
      "excel",
      "word",
      "windows",
      "linux",
    ])
  ) {
    signals.push("domain_informatics_concepts");
    return { domainSpecialization: "informatics_concepts", signals };
  }

  if (
    hasAny(joined, [
      "informatica",
      "comando",
      "atalho",
      "cmd",
      "powershell",
      "terminal",
      "prompt",
      "linux",
      "windows",
      "excel",
      "word",
      "navegacao por menus",
      "tecla de atalho",
      "sintaxe",
    ]) ||
    hasAny(likelyMistakeKey, ["comando", "sintaxe", "atalho", "caminho"]) ||
    hasAny((feedback.feedbackSignals || []).join(" "), ["practice"])
  ) {
    signals.push("domain_informatics_commands");
    return { domainSpecialization: "informatics_commands", signals };
  }

  return { domainSpecialization: "", signals };
}

function inferGeneralModeFromKeywords(subjectKey, topicKey, likelyMistakeKey, feedback) {
  const joined = `${subjectKey} ${topicKey}`;
  const signals = [];

  if (
    hasAny(joined, [
      "direito",
      "constitucional",
      "administrativo",
      "penal",
      "processual",
      "tributario",
      "civil",
      "previdenciario",
      "trabalhista",
      "legislacao",
      "lei",
      "norma",
      "competencia",
      "recurso",
      "princ",
    ]) ||
    hasAny(likelyMistakeKey, ["excecao", "literal", "requisito", "instituto"])
  ) {
    signals.push("subject_legal_keywords");
    return { subjectMode: "legal_literal", signals };
  }

  if (
    hasAny(joined, [
      "interpretacao",
      "compreensao",
      "texto",
      "portugues",
      "lingua portuguesa",
      "leitura",
      "enunciado",
      "analise textual",
    ]) ||
    feedback.confusionSource === "enunciado" ||
    feedback.confusionSource === "alternatives" ||
    hasAny(likelyMistakeKey, ["enunciado", "alternativa", "comando", "criterio"])
  ) {
    signals.push("reading_command_signals");
    return { subjectMode: "reading_interpretation", signals };
  }

  if (
    hasAny(joined, [
      "logica",
      "raciocinio logico",
      "matematica",
      "algorit",
      "proced",
      "passo",
      "sequencia",
      "fluxo",
      "etapa",
      "calculo",
      "estatistica",
    ]) ||
    hasAny(likelyMistakeKey, ["ordem logica", "passo decisivo", "sequencia", "procedimento"])
  ) {
    signals.push("procedural_sequence_signals");
    return { subjectMode: "logical_procedural", signals };
  }

  if (
    hasAny(joined, [
      "historia",
      "geografia",
      "informatica",
      "classificacao",
      "conceitos basicos",
      "terminologia",
      "memoriz",
      "prazo",
      "datas",
      "siglas",
      "artigo",
    ]) ||
    hasAny(likelyMistakeKey, ["prazo", "classificacao", "detalhe nominal", "memoriz"])
  ) {
    signals.push("precision_memory_signals");
    return { subjectMode: "memorization_precision", signals };
  }

  if (
    feedback.preferredNextMove === "contrast" ||
    feedback.confusionSource === "concept" ||
    hasAny(likelyMistakeKey, ["conceito", "nuance", "diferencia", "conceitos parecidos"])
  ) {
    signals.push("contrast_concept_signals");
    return { subjectMode: "conceptual_compare", signals };
  }

  signals.push("default_conceptual_compare");
  return { subjectMode: "conceptual_compare", signals };
}

export function inferSubjectPedagogy({
  subjectName,
  topicName,
  predictedRisk,
  learningFeedback,
} = {}) {
  const subjectKey = normalizeText(subjectName);
  const topicKey = normalizeText(topicName);
  const likelyMistakeKey = normalizeText(predictedRisk?.likelyMistake);
  const weakFocusKey = normalizeText(predictedRisk?.weakFocus);
  const reasonKey = normalizeText(predictedRisk?.reason);
  const feedback = normalizeLearningFeedback(learningFeedback);
  const domainInference = inferDomainSpecialization({
    subjectKey,
    topicKey,
    likelyMistakeKey,
    interventionStyle: predictedRisk?.interventionStyle ?? "",
    feedback,
    weakFocusKey,
    reasonKey,
  });
  const generalInference = inferGeneralModeFromKeywords(subjectKey, topicKey, likelyMistakeKey, feedback);
  const domainProfile = domainInference.domainSpecialization
    ? DOMAIN_PROFILES[domainInference.domainSpecialization]
    : null;
  const subjectMode = domainProfile?.subjectMode ?? generalInference.subjectMode;
  const generalProfile = GENERAL_MODE_PROFILES[subjectMode] ?? GENERAL_MODE_PROFILES.conceptual_compare;
  const profile = { ...generalProfile, ...(domainProfile || {}) };

  return {
    subjectMode,
    domainSpecialization: domainInference.domainSpecialization || "",
    pedagogyBias: profile.pedagogyBias,
    toneHint: profile.toneHint,
    explanationBias: profile.explanationBias,
    chatBias: profile.chatBias,
    reason:
      profile.reason ||
      (subjectMode === "legal_literal"
        ? "há sinais de disciplina com peso maior de literalidade, institutos e exceções"
        : subjectMode === "logical_procedural"
          ? "há sinais de conteúdo que pede sequência lógica, passos e checagem de raciocínio"
          : subjectMode === "reading_interpretation"
            ? "há sinais de conteúdo em que o comando do enunciado e a leitura das alternativas pesam mais"
            : subjectMode === "memorization_precision"
              ? "há sinais de conteúdo sensível a detalhe, classificação ou precisão terminológica"
              : "há sinais de conteúdo em que comparar conceitos e nuances tende a render mais"),
    biasSignals: uniq(
      [
        ...generalInference.signals,
        ...domainInference.signals,
        ...(predictedRisk?.interventionStyle ? [`base_style:${predictedRisk.interventionStyle}`] : []),
        ...(feedback.feedbackSignals || []).slice(0, 2),
      ],
      8
    ),
  };
}

function buildPedagogyProfile(subjectPedagogy) {
  if (!subjectPedagogy) return GENERAL_MODE_PROFILES.conceptual_compare;
  const domainProfile = subjectPedagogy.domainSpecialization
    ? DOMAIN_PROFILES[subjectPedagogy.domainSpecialization]
    : null;
  const generalProfile =
    GENERAL_MODE_PROFILES[subjectPedagogy.subjectMode] ?? GENERAL_MODE_PROFILES.conceptual_compare;
  return { ...generalProfile, ...(domainProfile || {}) };
}

function resolveSubjectInterventionStyle(subjectPedagogy, predictedRisk, feedback) {
  const mode = subjectPedagogy?.subjectMode;
  const domain = subjectPedagogy?.domainSpecialization;
  if (domain === "portuguese_interpretation") return "exam_trap";
  if (domain === "portuguese_grammar") {
    return predictedRisk.level === "high" ? "contrast_example" : "check_understanding";
  }
  if (domain === "math_arithmetic") {
    return predictedRisk.level === "high" ? "warning_light" : "check_understanding";
  }
  if (domain === "math_logical_reasoning") {
    return predictedRisk.level === "high" ? "warning_light" : "check_understanding";
  }
  if (domain === "informatics_concepts") return "contrast_example";
  if (domain === "informatics_commands") {
    return predictedRisk.level === "high" ? "warning_light" : "check_understanding";
  }
  if (domain === "legal_constitutional" || domain === "legal_administrative") {
    return predictedRisk.level === "high" || feedback.preferredNextMove === "contrast"
      ? "contrast_example"
      : "exam_trap";
  }
  if (mode === "reading_interpretation") return "exam_trap";
  if (mode === "legal_literal") {
    return predictedRisk.level === "high" || feedback.preferredNextMove === "contrast"
      ? "contrast_example"
      : "exam_trap";
  }
  if (mode === "logical_procedural") {
    return predictedRisk.level === "high" ? "warning_light" : "check_understanding";
  }
  if (mode === "memorization_precision") {
    return predictedRisk.level === "high" ? "warning_light" : "check_understanding";
  }
  return "contrast_example";
}

export function applySubjectPedagogyToPredictedRisk(predictedRisk, subjectPedagogy, learningFeedback) {
  if (!predictedRisk || typeof predictedRisk !== "object" || !subjectPedagogy?.subjectMode) {
    return predictedRisk;
  }
  const feedback = normalizeLearningFeedback(learningFeedback);
  const profile = buildPedagogyProfile(subjectPedagogy);
  const likelyMistakeRaw = normalizeText(predictedRisk.likelyMistake);
  const likelyMistake = isGenericLikelyMistake(likelyMistakeRaw)
    ? profile.likelyMistake
    : predictedRisk.likelyMistake;

  const interventionStyle = resolveSubjectInterventionStyle(subjectPedagogy, predictedRisk, feedback);
  const weakFocusBase = String(predictedRisk.weakFocus ?? "").trim();
  const weakFocusSuffix = profile.weakFocusHint;

  const reasonBase = String(predictedRisk.reason ?? "").trim();
  return {
    ...predictedRisk,
    likelyMistake,
    interventionStyle,
    weakFocus: weakFocusBase ? `${weakFocusBase}; ${weakFocusSuffix}` : weakFocusSuffix,
    reason: reasonBase
      ? `${reasonBase}; com viés de ${subjectPedagogy.domainSpecialization || subjectPedagogy.subjectMode}`
      : subjectPedagogy.reason,
    subjectMode: subjectPedagogy.subjectMode,
    domainSpecialization: subjectPedagogy.domainSpecialization,
    meta: {
      ...(predictedRisk.meta && typeof predictedRisk.meta === "object" ? predictedRisk.meta : {}),
      subjectMode: subjectPedagogy.subjectMode,
      domainSpecialization: subjectPedagogy.domainSpecialization,
      pedagogyBias: subjectPedagogy.pedagogyBias,
      biasSignals: subjectPedagogy.biasSignals,
    },
  };
}

export function applySubjectPedagogyToLearningFeedback(learningFeedback, subjectPedagogy) {
  const fb = normalizeLearningFeedback(learningFeedback);
  if (!subjectPedagogy?.subjectMode) return fb;

  let confusionSource = fb.confusionSource;
  let preferredNextMove = fb.preferredNextMove;
  const domain = subjectPedagogy.domainSpecialization;

  if (
    !confusionSource &&
    (subjectPedagogy.subjectMode === "reading_interpretation" || domain === "portuguese_interpretation")
  ) {
    confusionSource = fb.studentConfidence === "low" ? "enunciado" : "";
  }
  if (!preferredNextMove) {
    if (domain === "legal_constitutional" || domain === "legal_administrative") {
      preferredNextMove = "contrast";
    } else if (domain === "portuguese_grammar") {
      preferredNextMove = fb.studentConfidence === "low" ? "simplify" : "contrast";
    } else if (domain === "portuguese_interpretation") {
      preferredNextMove = "contrast";
    } else if (domain === "math_arithmetic" || domain === "math_logical_reasoning") {
      preferredNextMove = "simplify";
    } else if (domain === "informatics_concepts") {
      preferredNextMove = "contrast";
    } else if (domain === "informatics_commands") {
      preferredNextMove = fb.studentConfidence === "low" ? "review_base" : "practice";
    } else if (subjectPedagogy.subjectMode === "legal_literal") preferredNextMove = "contrast";
    else if (subjectPedagogy.subjectMode === "logical_procedural" && fb.studentConfidence === "low") {
      preferredNextMove = "simplify";
    } else if (subjectPedagogy.subjectMode === "conceptual_compare") {
      preferredNextMove = "contrast";
    } else if (
      subjectPedagogy.subjectMode === "memorization_precision" &&
      fb.explanationHelpfulness === "not_helped"
    ) {
      preferredNextMove = "review_base";
    }
  }

  return {
    ...fb,
    confusionSource,
    preferredNextMove,
    feedbackSignals: uniq(
      [
        ...fb.feedbackSignals,
        `subject_mode:${subjectPedagogy.subjectMode}`,
        ...(subjectPedagogy.domainSpecialization
          ? [`domain_specialization:${subjectPedagogy.domainSpecialization}`]
          : []),
        ...subjectPedagogy.biasSignals,
      ],
      10
    ),
  };
}
