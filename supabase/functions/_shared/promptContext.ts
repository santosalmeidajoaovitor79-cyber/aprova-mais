/** Linha extra com prazo da prova (body.examContext do cliente). */
export function formatExamContextLine(examContext: unknown): string {
  if (!examContext || typeof examContext !== "object") return "";
  const label = (examContext as { label?: string }).label;
  if (label && typeof label === "string" && label.trim()) {
    return `\n\nPlanejamento / prova do aluno: ${label.trim()}`;
  }
  return "";
}

/** Contexto explícito concurso → matéria → tópico enviado pelo app (body.studyContext). */
export function formatStudyContextLine(studyContext: unknown): string {
  if (!studyContext || typeof studyContext !== "object") return "";
  const sc = studyContext as {
    contestName?: string | null;
    subjectName?: string | null;
    topicName?: string | null;
  };
  const parts = [sc.contestName, sc.subjectName, sc.topicName].filter(
    (x) => typeof x === "string" && x.trim()
  ) as string[];
  if (!parts.length) return "";
  return `\n\nSeleção atual do aluno (app): ${parts.join(" → ")}`;
}

export function formatExamContextBullet(examContext: unknown): string {
  if (!examContext || typeof examContext !== "object") return "";
  const label = (examContext as { label?: string }).label;
  if (label && typeof label === "string" && label.trim()) {
    return `\n- ${label.trim()}`;
  }
  return "";
}

export function formatStudyContextBullet(studyContext: unknown): string {
  if (!studyContext || typeof studyContext !== "object") return "";
  const sc = studyContext as {
    contestName?: string | null;
    subjectName?: string | null;
    topicName?: string | null;
  };
  const parts = [sc.contestName, sc.subjectName, sc.topicName].filter(
    (x) => typeof x === "string" && x.trim()
  ) as string[];
  if (!parts.length) return "";
  return `\n- Seleção no app: ${parts.join(" → ")}`;
}

type PredictedRiskPayload = {
  level?: "low" | "medium" | "high";
  reason?: string;
  weakFocus?: string;
  likelyMistake?: string;
  interventionStyle?: "warning_light" | "contrast_example" | "check_understanding" | "exam_trap";
  subjectMode?: string;
  domainSpecialization?: string;
  meta?: Record<string, unknown>;
};

type PredictedRiskPromptVariant = "studyChat" | "topicExplanation";
type NextBestActionPayload = {
  action?:
    | "explain_core"
    | "contrast_concepts"
    | "check_understanding"
    | "give_exam_trap"
    | "practice_now"
    | "recover_foundation"
    | "summarize_then_practice";
  reason?: string;
  flowMoment?: "explanation" | "chat" | "pre_questions" | "post_explanation";
};

type LearningFeedbackPayload = {
  explanationHelpfulness?: string;
  confusionSource?: string;
  preventiveHintWorked?: string;
  studentConfidence?: string;
  preferredNextMove?: string;
  feedbackSignals?: string[];
};

type SubjectPedagogyPayload = {
  subjectMode?:
    | "legal_literal"
    | "logical_procedural"
    | "conceptual_compare"
    | "reading_interpretation"
    | "memorization_precision";
  domainSpecialization?:
    | "legal_constitutional"
    | "legal_administrative"
    | "portuguese_grammar"
    | "portuguese_interpretation"
    | "math_arithmetic"
    | "math_logical_reasoning"
    | "informatics_concepts"
    | "informatics_commands";
  pedagogyBias?: string;
  toneHint?: string;
  explanationBias?: string;
  chatBias?: string;
  reason?: string;
  biasSignals?: string[];
  bancaStyle?: string;
  trapStyle?: string;
  trapSignals?: string[];
};

type BancaAwareTrapPayload = {
  bancaStyle?: "cebraspe_style" | "fgv_style" | "fcc_style" | "vunesp_style" | "ibfc_style" | "generic_exam_style";
  trapStyle?:
    | "literal_exception_trap"
    | "absolute_alternative_trap"
    | "wording_inversion_trap"
    | "concept_distractor_trap"
    | "procedural_order_trap"
    | "command_interpretation_trap";
  alertBias?: string;
  explanationBias?: string;
  chatBias?: string;
  toneHint?: string;
  reason?: string;
  trapSignals?: string[];
};

/**
 * Predição leve de risco antes da prática.
 * A ideia é antecipar tropeços sem alarmar o aluno.
 */
export function formatPredictedRiskForPrompt(
  predictedRisk: unknown,
  opts?: { variant?: PredictedRiskPromptVariant }
): string {
  if (!predictedRisk || typeof predictedRisk !== "object") return "";
  const variant: PredictedRiskPromptVariant = opts?.variant ?? "studyChat";
  const pr = predictedRisk as PredictedRiskPayload;
  const level =
    pr.level === "low" || pr.level === "medium" || pr.level === "high" ? pr.level : null;
  if (!level) return "";
  if (level === "low") return "";

  const reason = typeof pr.reason === "string" ? pr.reason.trim().slice(0, 220) : "";
  const weakFocus = typeof pr.weakFocus === "string" ? pr.weakFocus.trim().slice(0, 160) : "";
  const likelyMistake =
    typeof pr.likelyMistake === "string" ? pr.likelyMistake.trim().slice(0, 220) : "";
  const interventionStyle =
    pr.interventionStyle === "warning_light" ||
    pr.interventionStyle === "contrast_example" ||
    pr.interventionStyle === "check_understanding" ||
    pr.interventionStyle === "exam_trap"
      ? pr.interventionStyle
      : null;

  const levelLabel =
    level === "high"
      ? "high (chance relevante de tropeço se entrar direto na prática)"
      : level === "medium"
        ? "medium (vale uma proteção leve antes da prática)"
        : "low (não precisa interferir cedo)";
  const interventionLabel =
    interventionStyle === "warning_light"
      ? "warning_light (aviso leve e estratégico)"
      : interventionStyle === "contrast_example"
        ? "contrast_example (mostrar contraste ou contraexemplo curto)"
        : interventionStyle === "check_understanding"
          ? "check_understanding (checagem breve de entendimento)"
          : interventionStyle === "exam_trap"
            ? "exam_trap (alerta de pegadinha / leitura de enunciado)"
            : "";

  const lines = [
    "\n\nPREDIÇÃO DE ERRO (estimativa preventiva do app — use com naturalidade; não fale em ‘risco’ como diagnóstico ao aluno):",
    `- Nível previsto para este tópico: ${levelLabel}.`,
  ];
  if (reason) lines.push(`- Motivo principal: ${reason}.`);
  if (weakFocus) lines.push(`- Ponto mais sensível para vigiar: ${weakFocus}.`);
  if (likelyMistake) lines.push(`- Erro provável a antecipar: ${likelyMistake}.`);
  if (interventionLabel) lines.push(`- Microintervenção sugerida: ${interventionLabel}.`);
  lines.push("");
  lines.push("Como agir a partir disso (obrigatório):");
  if (variant === "topicExplanation") {
    lines.push("- Se likelyMistake existir, antecipe essa confusão com naturalidade e sem mencionar sistema interno.");
    lines.push("- Se o risco for high: reforce o ponto crítico ainda no bloco de conceito e deixe explícito o contraste ou detalhe decisivo antes do exemplo.");
    lines.push("- Se o risco for medium: faça um reforço leve no conceito ou na transição para o exemplo, sem pesar a mão.");
    lines.push("- Use esse sinal para melhorar clareza e prevenção, não para dramatizar.");
  } else {
    lines.push("- Se likelyMistake existir, priorize esse erro provável em vez de alertas genéricos.");
    lines.push("- Se o risco for high: antecipe um erro comum, reforce o ponto crítico ou entregue uma microdica estratégica antes de mandar o aluno para prática.");
    lines.push("- Se o risco for medium: faça uma dica leve, um lembrete curto ou uma pergunta preventiva, sem interromper demais o fluxo.");
    lines.push("- Use a predição só quando realmente agregar, especialmente antes de questões, ao sugerir prática, ou quando o aluno demonstrar dúvida.");
    lines.push("- Não repita a mesma intervenção preventiva em mensagens consecutivas; se você já alertou sobre esse ponto no turno anterior, só retome se o aluno voltar ao mesmo tropeço ou pedir questões.");
    lines.push("- Use no máximo uma microintervenção por resposta.");
  }
  lines.push("- Mantenha tom natural, útil e calmo; nunca alarme o aluno nem soe como previsão fatalista.");
  lines.push("- A ideia é prevenir erro provável, não travar o avanço.");

  return lines.join("\n");
}

export function formatNextBestActionForPrompt(
  nextBestAction: unknown,
  opts?: { variant?: PredictedRiskPromptVariant }
): string {
  if (!nextBestAction || typeof nextBestAction !== "object") return "";
  const variant: PredictedRiskPromptVariant = opts?.variant ?? "studyChat";
  const nba = nextBestAction as NextBestActionPayload;
  const action =
    nba.action === "explain_core" ||
    nba.action === "contrast_concepts" ||
    nba.action === "check_understanding" ||
    nba.action === "give_exam_trap" ||
    nba.action === "practice_now" ||
    nba.action === "recover_foundation" ||
    nba.action === "summarize_then_practice"
      ? nba.action
      : null;
  if (!action) return "";

  const reason = typeof nba.reason === "string" ? nba.reason.trim().slice(0, 220) : "";
  const flowMoment =
    nba.flowMoment === "explanation" ||
    nba.flowMoment === "chat" ||
    nba.flowMoment === "pre_questions" ||
    nba.flowMoment === "post_explanation"
      ? nba.flowMoment
      : "chat";

  const actionLabel =
    action === "explain_core"
      ? "explain_core (explicar o núcleo do tópico com clareza)"
      : action === "contrast_concepts"
        ? "contrast_concepts (contrastar conceitos, casos ou nuances)"
        : action === "check_understanding"
          ? "check_understanding (checar entendimento ativamente)"
          : action === "give_exam_trap"
            ? "give_exam_trap (alertar sobre pegadinha de prova)"
            : action === "practice_now"
              ? "practice_now (encaminhar para prática agora)"
              : action === "recover_foundation"
                ? "recover_foundation (reconstruir a base antes de avançar)"
                : "summarize_then_practice (fechar em síntese curta e partir para prática)";

  const momentLabel =
    flowMoment === "explanation"
      ? "explicação inicial"
      : flowMoment === "pre_questions"
        ? "pré-questões"
        : flowMoment === "post_explanation"
          ? "logo após a explicação"
          : "chat";

  const lines = [
    "\n\nNEXT BEST ACTION (decisão pedagógica dominante para este momento — use como bússola, sem citar lógica interna):",
    `- Movimento dominante sugerido: ${actionLabel}.`,
    `- Momento atual do fluxo: ${momentLabel}.`,
  ];
  if (reason) lines.push(`- Por que este é o melhor próximo passo: ${reason}.`);
  lines.push("");
  lines.push("Como usar isso (obrigatório):");
  lines.push("- Escolha no máximo um movimento pedagógico dominante por resposta.");
  lines.push("- Não transforme isso em roteiro mecânico; mantenha naturalidade.");
  lines.push("- Se houver conflito entre este movimento e o estado da sessão, respeite o estado da sessão.");
  if (variant === "topicExplanation") {
    lines.push("- Na explicação inicial, esse movimento deve influenciar principalmente a ordem de ênfase entre conceito, contraste, reforço de base e passagem para o exemplo.");
  } else {
    lines.push("- No chat, use esse movimento para decidir se a resposta deve explicar, contrastar, testar, resumir ou puxar prática.");
  }
  return lines.join("\n");
}

export function formatLearningFeedbackForPrompt(
  learningFeedback: unknown,
  opts?: { variant?: PredictedRiskPromptVariant }
): string {
  if (!learningFeedback || typeof learningFeedback !== "object") return "";
  const variant: PredictedRiskPromptVariant = opts?.variant ?? "studyChat";
  const lf = learningFeedback as LearningFeedbackPayload;
  const explanationHelpfulness =
    typeof lf.explanationHelpfulness === "string" ? lf.explanationHelpfulness.trim() : "";
  const confusionSource = typeof lf.confusionSource === "string" ? lf.confusionSource.trim() : "";
  const preventiveHintWorked =
    typeof lf.preventiveHintWorked === "string" ? lf.preventiveHintWorked.trim() : "";
  const studentConfidence = typeof lf.studentConfidence === "string" ? lf.studentConfidence.trim() : "";
  const preferredNextMove = typeof lf.preferredNextMove === "string" ? lf.preferredNextMove.trim() : "";
  const feedbackSignals = Array.isArray(lf.feedbackSignals)
    ? lf.feedbackSignals.filter((x) => typeof x === "string" && x.trim()).slice(0, 6)
    : [];

  if (
    !explanationHelpfulness &&
    !confusionSource &&
    !preventiveHintWorked &&
    !studentConfidence &&
    !preferredNextMove &&
    feedbackSignals.length === 0
  ) {
    return "";
  }

  const lines = [
    "\n\nLEARNING FEEDBACK LOOP (sinais pedagógicos da sessão — use com naturalidade e sem soar como formulário):",
  ];
  if (explanationHelpfulness) lines.push(`- A explicação recente pareceu: ${explanationHelpfulness}.`);
  if (confusionSource) lines.push(`- A fonte de confusão mais provável neste momento: ${confusionSource}.`);
  if (preventiveHintWorked) lines.push(`- A dica preventiva anterior parece ter funcionado: ${preventiveHintWorked}.`);
  if (studentConfidence) lines.push(`- Confiança atual percebida do aluno: ${studentConfidence}.`);
  if (preferredNextMove) lines.push(`- Próximo movimento que o aluno parece preferir agora: ${preferredNextMove}.`);
  if (feedbackSignals.length) lines.push(`- Sinais recentes observados: ${feedbackSignals.join(", ")}.`);
  lines.push("");
  lines.push("Como usar isso (obrigatório):");
  lines.push("- Aproveite feedback implícito antes de perguntar explicitamente qualquer coisa.");
  lines.push("- Faça no máximo uma microcoleta de feedback quando realmente útil.");
  lines.push("- Não transforme a conversa em questionário.");
  lines.push("- Use esse feedback para ajustar prioridade entre explicar, contrastar, revisar base, testar ou praticar.");
  if (variant === "studyChat") {
    lines.push("- Só pergunte algo leve como feedback quando isso realmente desbloquear o próximo passo pedagógico.");
  } else {
    lines.push("- Na explicação inicial, use esse feedback para ajustar ênfase, clareza e tom, sem abrir perguntas ao aluno.");
  }
  return lines.join("\n");
}

export function formatSubjectPedagogyForPrompt(
  subjectPedagogy: unknown,
  opts?: { variant?: PredictedRiskPromptVariant }
): string {
  if (!subjectPedagogy || typeof subjectPedagogy !== "object") return "";
  const variant: PredictedRiskPromptVariant = opts?.variant ?? "studyChat";
  const sp = subjectPedagogy as SubjectPedagogyPayload;
  const subjectMode =
    sp.subjectMode === "legal_literal" ||
    sp.subjectMode === "logical_procedural" ||
    sp.subjectMode === "conceptual_compare" ||
    sp.subjectMode === "reading_interpretation" ||
    sp.subjectMode === "memorization_precision"
      ? sp.subjectMode
      : null;
  if (!subjectMode) return "";
  const domainSpecialization =
    sp.domainSpecialization === "legal_constitutional" ||
    sp.domainSpecialization === "legal_administrative" ||
    sp.domainSpecialization === "portuguese_grammar" ||
    sp.domainSpecialization === "portuguese_interpretation" ||
    sp.domainSpecialization === "math_arithmetic" ||
    sp.domainSpecialization === "math_logical_reasoning" ||
    sp.domainSpecialization === "informatics_concepts" ||
    sp.domainSpecialization === "informatics_commands"
      ? sp.domainSpecialization
      : "";

  const pedagogyBias = typeof sp.pedagogyBias === "string" ? sp.pedagogyBias.trim() : "";
  const toneHint = typeof sp.toneHint === "string" ? sp.toneHint.trim() : "";
  const explanationBias = typeof sp.explanationBias === "string" ? sp.explanationBias.trim() : "";
  const chatBias = typeof sp.chatBias === "string" ? sp.chatBias.trim() : "";
  const reason = typeof sp.reason === "string" ? sp.reason.trim() : "";
  const biasSignals = Array.isArray(sp.biasSignals)
    ? sp.biasSignals.filter((x) => typeof x === "string" && x.trim()).slice(0, 6)
    : [];

  const lines = [
    "\n\nDISCIPLINA-AWARE PEDAGOGY (viés pedagógico do conteúdo atual — use sem citar lógica interna):",
    `- Modo didático inferido para esta matéria/tópico: ${subjectMode}.`,
  ];
  if (domainSpecialization) {
    lines.push(`- Especialização de domínio inferida: ${domainSpecialization}.`);
  }
  if (pedagogyBias) lines.push(`- Viés principal de condução: ${pedagogyBias}.`);
  if (toneHint) lines.push(`- Ajuste fino de tom: ${toneHint}.`);
  if (reason) lines.push(`- Motivo do enquadramento: ${reason}.`);
  if (variant === "topicExplanation" && explanationBias) {
    lines.push(`- Como isso deve afetar a explicação: ${explanationBias}.`);
  }
  if (variant === "studyChat" && chatBias) {
    lines.push(`- Como isso deve afetar a conversa: ${chatBias}.`);
  }
  if (biasSignals.length) lines.push(`- Sinais usados para esse enquadramento: ${biasSignals.join(", ")}.`);
  lines.push("");
  lines.push("Como usar isso (obrigatório):");
  lines.push("- Adapte likelyMistake, intervenção e explicação ao tipo de disciplina.");
  lines.push("- Se houver especialização de domínio, ela vale mais que o modo geral para calibrar a resposta.");
  lines.push("- Em direito, priorize literalidade, exceções e contraste entre institutos.");
  lines.push("- Em constitucional, destaque competência, princípio, garantia e exceção relevante.");
  lines.push("- Em administrativo, destaque atributo, requisito, poder e limite do instituto.");
  lines.push("- Em gramática, valorize regra, exceção e contraste entre construções parecidas.");
  lines.push("- Em interpretação de texto, valorize comando, critério e distrator da alternativa.");
  lines.push("- Em aritmética, organize a conta, o sinal, a unidade e a checagem do resultado.");
  lines.push("- Em raciocínio lógico, valide conectivo, negação, equivalência e passo inferencial.");
  lines.push("- Em informática conceitual, compare função, categoria e uso de conceitos próximos.");
  lines.push("- Em informática operacional, destaque comando, sintaxe, atalho e caminho correto.");
  lines.push("- Em conteúdo lógico/procedural, priorize sequência de passos, checagem curta e reconstrução de base.");
  lines.push("- Em leitura/interpretação, priorize comando do enunciado, critério da pergunta e leitura de alternativas.");
  lines.push("- Em conteúdo mais conceitual, contraste ideias próximas antes de empilhar teoria.");
  lines.push("- Em conteúdo sensível a memorização/precisão, realce o detalhe crítico e sintetize sem perder rigor.");
  lines.push("- Mantenha naturalidade: isso ajusta o jeito de ensinar, não vira etiqueta para citar ao aluno.");
  return lines.join("\n");
}

export function formatBancaAwareTrapForPrompt(
  bancaAwareTrap: unknown,
  opts?: { variant?: PredictedRiskPromptVariant }
): string {
  if (!bancaAwareTrap || typeof bancaAwareTrap !== "object") return "";
  const variant: PredictedRiskPromptVariant = opts?.variant ?? "studyChat";
  const bt = bancaAwareTrap as BancaAwareTrapPayload;
  const bancaStyle =
    bt.bancaStyle === "cebraspe_style" ||
    bt.bancaStyle === "fgv_style" ||
    bt.bancaStyle === "fcc_style" ||
    bt.bancaStyle === "vunesp_style" ||
    bt.bancaStyle === "ibfc_style" ||
    bt.bancaStyle === "generic_exam_style"
      ? bt.bancaStyle
      : "";
  const trapStyle =
    bt.trapStyle === "literal_exception_trap" ||
    bt.trapStyle === "absolute_alternative_trap" ||
    bt.trapStyle === "wording_inversion_trap" ||
    bt.trapStyle === "concept_distractor_trap" ||
    bt.trapStyle === "procedural_order_trap" ||
    bt.trapStyle === "command_interpretation_trap"
      ? bt.trapStyle
      : "";
  if (!trapStyle) return "";

  const alertBias = typeof bt.alertBias === "string" ? bt.alertBias.trim() : "";
  const explanationBias = typeof bt.explanationBias === "string" ? bt.explanationBias.trim() : "";
  const chatBias = typeof bt.chatBias === "string" ? bt.chatBias.trim() : "";
  const toneHint = typeof bt.toneHint === "string" ? bt.toneHint.trim() : "";
  const reason = typeof bt.reason === "string" ? bt.reason.trim() : "";
  const trapSignals = Array.isArray(bt.trapSignals)
    ? bt.trapSignals.filter((x) => typeof x === "string" && x.trim()).slice(0, 6)
    : [];

  const lines = [
    "\n\nBANCA-AWARE TRAPS (microcamada preventiva do estilo provável de cobrança — use sem citar lógica interna):",
    `- Armadilha preventiva dominante deste contexto: ${trapStyle}.`,
  ];
  if (bancaStyle) lines.push(`- Estilo heurístico de cobrança sugerido: ${bancaStyle}.`);
  if (alertBias) lines.push(`- Alerta preventivo mais útil agora: ${alertBias}.`);
  if (toneHint) lines.push(`- Ajuste fino de tom para esse alerta: ${toneHint}.`);
  if (reason) lines.push(`- Motivo do alerta: ${reason}.`);
  if (variant === "topicExplanation" && explanationBias) {
    lines.push(`- Como isso deve afetar a explicação: ${explanationBias}.`);
  }
  if (variant === "studyChat" && chatBias) {
    lines.push(`- Como isso deve afetar a conversa: ${chatBias}.`);
  }
  if (trapSignals.length) lines.push(`- Sinais usados para essa inferência: ${trapSignals.join(", ")}.`);
  lines.push("");
  lines.push("Como usar isso (obrigatório):");
  lines.push("- Use essa camada para calibrar o alerta preventivo sem transformar a resposta em lista de pegadinhas.");
  lines.push("- Se a armadilha for de exceção/literalidade, destaque a palavra que muda o sentido.");
  lines.push("- Se a armadilha for de alternativa absoluta, faça o aluno desconfiar de termos extremos.");
  lines.push("- Se a armadilha for de inversão de comando, reforce o verbo da pergunta e o critério da resposta.");
  lines.push("- Se a armadilha for conceitual, contraste o conceito certo com o distrator mais próximo.");
  lines.push("- Se a armadilha for procedural/order, reforce a sequência certa antes da prática.");
  lines.push("- Se a armadilha for de interpretação do comando, priorize leitura de enunciado e alternativas.");
  lines.push("- Use no máximo um alerta preventivo dominante por resposta.");
  return lines.join("\n");
}

type StudySessionPhase = "learning" | "checking" | "practice" | "review";
type StudySessionConfidence = "low" | "medium" | "high";
type StudySessionIntent = "doubt" | "confirmation" | "stuck" | "idle";

type StudySessionContextPayload = {
  phase?: StudySessionPhase;
  confidence?: StudySessionConfidence;
  lastUserIntent?: StudySessionIntent;
  loopCount?: number;
};

/**
 * Estado leve da sessão de estudo em tempo real (cliente).
 * Serve para a Yara escolher a intervenção mais útil sem virar fluxo rígido.
 */
export function formatStudySessionContextForPrompt(studySessionContext: unknown): string {
  if (!studySessionContext || typeof studySessionContext !== "object") return "";
  const ctx = studySessionContext as StudySessionContextPayload;

  const phase =
    ctx.phase === "learning" ||
    ctx.phase === "checking" ||
    ctx.phase === "practice" ||
    ctx.phase === "review"
      ? ctx.phase
      : null;
  const confidence =
    ctx.confidence === "low" || ctx.confidence === "medium" || ctx.confidence === "high"
      ? ctx.confidence
      : null;
  const lastUserIntent =
    ctx.lastUserIntent === "doubt" ||
    ctx.lastUserIntent === "confirmation" ||
    ctx.lastUserIntent === "stuck" ||
    ctx.lastUserIntent === "idle"
      ? ctx.lastUserIntent
      : null;
  const loopCount = Math.min(9, Math.max(0, Math.floor(Number(ctx.loopCount) || 0)));

  if (!phase && !confidence && !lastUserIntent && loopCount === 0) return "";

  const phaseLabel =
    phase === "learning"
      ? "learning (explicar e construir base)"
      : phase === "checking"
        ? "checking (validar entendimento)"
        : phase === "practice"
          ? "practice (aplicar e treinar)"
          : phase === "review"
            ? "review (recapitular e ajustar)"
            : "indefinida";

  const confidenceLabel =
    confidence === "low"
      ? "low (sinal de insegurança)"
      : confidence === "medium"
        ? "medium (base parcial)"
        : confidence === "high"
          ? "high (pode avançar ou testar)"
          : "indefinida";

  const intentLabel =
    lastUserIntent === "stuck"
      ? "stuck (travado / perdido)"
      : lastUserIntent === "confirmation"
        ? "confirmation (acha que entendeu)"
        : lastUserIntent === "doubt"
          ? "doubt (está perguntando / investigando)"
          : lastUserIntent === "idle"
            ? "idle (resposta curta / baixa sinalização)"
            : "indefinido";

  const lines = [
    "\n\nESTADO DA SESSÃO DE ESTUDO (contexto dinâmico do app — use para decidir a condução; não anuncie esse estado ao aluno):",
    `- Fase atual: ${phaseLabel}.`,
    `- Confiança percebida: ${confidenceLabel}.`,
    `- Último sinal do aluno: ${intentLabel}.`,
    `- Loop atual da conversa neste ciclo: ${loopCount}.`,
    "",
    "Como conduzir a partir deste estado (obrigatório):",
    "- Você deve escolher a intervenção mais útil entre: explicar, resumir, perguntar, testar ou direcionar para questões.",
    "- Não escolha explicar por padrão; varie conforme o estado.",
    "- Se o sinal for stuck: explique de outro jeito, com passos menores, contraste ou exemplo curto; evite repetir o mesmo bloco longo.",
    "- Se o sinal for confirmation: valide rapidamente e puxe uma checagem leve, pergunta diagnóstica ou mini teste.",
    "- Se a confiança estiver high: prefira resumir, testar nuance ou avançar; não reexplique o básico sem necessidade.",
    "- Se o loop estiver alto (3 ou mais): mude a abordagem em vez de insistir no mesmo formato.",
    "- Se a fase for learning: priorize clareza e construção de base.",
    "- Se a fase for checking: verifique entendimento de forma ativa.",
    "- Se a fase for practice: puxe aplicação, treino ou ida para questões quando fizer sentido.",
    "- Se a fase for review: recapitule padrões de erro, consolide e ajuste o próximo passo.",
    "- Evite repetir explicação longa desnecessária quando o estado indicar avanço ou saturação.",
  ];

  return lines.join("\n");
}

type LearningMemoryPayload = {
  studyDaysLast14?: number;
  studyDaysLast7?: number;
  quizAttemptsInScope?: number;
  globalAccuracyPercent?: number | null;
  accuracyLast7dPercent?: number | null;
  accuracyPrev7dPercent?: number | null;
  trendLabel?: string;
  weakTopics?: Array<{
    topicId?: string;
    topicName?: string;
    errors?: number;
    attempts?: number;
    accuracyPercent?: number | null;
  }>;
  recentWrongHints?: Array<{ topicName?: string; stemPreview?: string }>;
  recentStudyTopics?: Array<{ topicId?: string; topicName?: string }>;
  currentTopicId?: string | null;
  currentTopicQuiz?: {
    attempts?: number;
    wrong?: number;
    accuracyPercent?: number | null;
  } | null;
};

function formatLearningMemoryForPrompt(
  lm: LearningMemoryPayload,
  studyContext: unknown
): string {
  const sc =
    studyContext && typeof studyContext === "object"
      ? (studyContext as { topicId?: string | null; topicName?: string | null })
      : null;
  const currentId = sc?.topicId?.trim() || "";

  const parts: string[] = [];
  parts.push("\n\nMemória de estudo (dados reais agregados do app — use com empatia, sem culpar o aluno):");
  parts.push(
    `- Dias distintos com estudo neste concurso (últimos ~14 dias): ${lm.studyDaysLast14 ?? 0}.`
  );
  if ((lm.studyDaysLast7 ?? 0) > 0) {
    parts.push(`- Últimos ~7 dias: ${lm.studyDaysLast7} dia(s) com visita a tópico neste concurso.`);
  }
  if ((lm.quizAttemptsInScope ?? 0) > 0) {
    parts.push(
      `- Tentativas de quiz registradas neste concurso (amostra recente): ${lm.quizAttemptsInScope}.` +
        (lm.globalAccuracyPercent != null
          ? ` Taxa de acerto aproximada nessa amostra: ${lm.globalAccuracyPercent}%.`
          : "")
    );
  }
  if (lm.accuracyLast7dPercent != null || lm.accuracyPrev7dPercent != null) {
    parts.push(
      `- Evolução recente (quiz): últimos 7 dias ~${lm.accuracyLast7dPercent ?? "—"}% acerto; ` +
        `7 dias anteriores ~${lm.accuracyPrev7dPercent ?? "—"}%.`
    );
  }
  const trend = lm.trendLabel ?? "unknown";
  if (trend === "improving") {
    parts.push("- Tendência: melhora recente na taxa de acerto — reconheça o progresso com naturalidade.");
  } else if (trend === "declining") {
    parts.push(
      "- Tendência: queda recente na taxa de acerto — reforçar base, revisão espaçada e clareza, sem julgamento."
    );
  } else if (trend === "stable") {
    parts.push("- Tendência: desempenho estável — ajuste fino e consolidação costumam ajudar.");
  }

  const weak = Array.isArray(lm.weakTopics) ? lm.weakTopics : [];
  if (weak.length) {
    const lines = weak
      .slice(0, 5)
      .map((w) => {
        const name = (w.topicName ?? "Tópico").trim();
        const err = w.errors ?? 0;
        const att = w.attempts ?? 0;
        const acc = w.accuracyPercent != null ? `${w.accuracyPercent}% acerto` : "taxa indisponível";
        return `  • ${name}: ${err} erro(s) em ${att} tentativa(s) (${acc})`;
      })
      .join("\n");
    parts.push(`- Tópicos com mais fricção neste concurso (prioridade de reforço):\n${lines}`);
  }

  const recentStudy = Array.isArray(lm.recentStudyTopics) ? lm.recentStudyTopics : [];
  if (recentStudy.length) {
    const names = recentStudy
      .slice(0, 6)
      .map((r) => (r.topicName ?? "Tópico").trim() || "Tópico")
      .filter(Boolean);
    const uniq = [...new Set(names)];
    if (uniq.length) {
      parts.push(
        `- Tópicos abertos recentemente neste concurso (rotina — útil para simulado e continuidade): ${uniq.join(", ")}.`
      );
    }
  }

  const hints = Array.isArray(lm.recentWrongHints) ? lm.recentWrongHints : [];
  if (hints.length) {
    const hl = hints
      .slice(0, 3)
      .map((h) => {
        const tn = (h.topicName ?? "").trim() || "Tópico";
        const prev = (h.stemPreview ?? "").trim();
        return prev ? `  • [${tn}] ${prev}` : `  • [${tn}] (enunciado resumido indisponível)`;
      })
      .join("\n");
    parts.push(`- Últimos erros relevantes (trechos do enunciado):\n${hl}`);
  }

  if (currentId && lm.currentTopicQuiz && lm.currentTopicQuiz.attempts) {
    const q = lm.currentTopicQuiz;
    parts.push(
      `- Tópico atual (este chat / esta tela): ${q.attempts} tentativa(s) registradas, ` +
        `${q.wrong ?? 0} erro(s)` +
        (q.accuracyPercent != null ? `, ~${q.accuracyPercent}% de acerto.` : ".")
    );
  } else if (currentId) {
    parts.push(
      "- Tópico atual: poucas ou nenhuma tentativa de quiz registrada ainda — favoreça clareza e exemplo guiado."
    );
  }

  const isCurrentWeak =
    currentId &&
    weak.some((w) => w.topicId === currentId || (w.topicName && sc?.topicName && w.topicName === sc.topicName));
  const lowAcc =
    lm.currentTopicQuiz?.accuracyPercent != null && lm.currentTopicQuiz.accuracyPercent < 55;
  const highAcc =
    lm.currentTopicQuiz?.accuracyPercent != null && lm.currentTopicQuiz.accuracyPercent >= 82;

  parts.push("\nComo adaptar sua resposta (obrigatório considerar a memória acima):");
  if (isCurrentWeak || lowAcc) {
    parts.push(
      "- Este tópico concentra muitos erros ou taxa baixa: explique com linguagem mais simples, passos menores, um exemplo curto e, se útil, um contraste com o erro típico."
    );
  }
  if (highAcc && !lowAcc) {
    parts.push(
      "- O aluno vai bem neste tópico nas questões registradas: respostas mais diretas, nuances e armadilhas de prova, sem reexplicar o básico sem necessidade."
    );
  }
  if (hints.length && currentId) {
    parts.push(
      "- Se a dúvida tocar no mesmo padrão dos erros recentes listados, diga explicitamente que isso é um ponto recorrente e ofereça um atalho mental ou checklist."
    );
  }
  if (trend === "improving") {
    parts.push("- Reforce o hábito: pequenos ganhos consistentes importam.");
  }

  return parts.join("\n");
}

type ExamReadinessPayload = {
  score?: number;
  band?: string;
  label?: string;
  headline?: string;
  bullets?: string[];
  coachHint?: string;
};

/** Prontidão estimada (Readiness Engine) — tom motivador, sem julgamento. */
function formatExamReadinessForPrompt(
  er: ExamReadinessPayload,
  variant: "default" | "studyChat"
): string {
  const score = typeof er.score === "number" && Number.isFinite(er.score) ? Math.round(er.score) : null;
  const band = er.band;
  if (score == null || (band !== "low" && band !== "medium" && band !== "high")) return "";

  const label = (er.label ?? "").trim() || "—";
  const headline = (er.headline ?? "").trim();
  const coach = (er.coachHint ?? "").trim();
  const bullets = Array.isArray(er.bullets) ? er.bullets.map((b) => (typeof b === "string" ? b.trim() : "")).filter(Boolean).slice(0, 3) : [];

  const parts: string[] = [];
  parts.push(
    "\n\nProntidão para a prova (estimativa interna do app — não cite o número como ‘veredito’ nem julgue o aluno):"
  );
  parts.push(`- Índice estimado: ${score}/100 — perfil: “${label}”.`);
  if (headline) parts.push(`- Leitura humana: ${headline}`);
  if (bullets.length) {
    parts.push("- Pontos para orientar (sem listar em voz alta de uma vez; use só o que couber):");
    for (const b of bullets) parts.push(`  • ${b}`);
  }
  if (variant === "studyChat") {
    parts.push(
      "Regras para a Yara com este índice: linguagem de evolução e parceria; nunca culpar nem dramatizar. " +
        (band === "low"
          ? "Se o aluno não pediu ajuda com desempenho, não force o tema; se pedir, ofereça um passo curto e realista."
          : band === "medium"
            ? "Reforce hábito e clareza; convide a pequenos ciclos de revisão + prática."
            : "Reconheça a base; desafie com nuances e cuidado com overconfidence leve.") +
        (coach ? ` Tom sugerido: ${coach}` : "")
    );
  } else {
    parts.push(
      "Regras gerais: motivação autêntica, foco em próximo passo mensurável." +
        (coach ? ` Tom sugerido: ${coach}` : "")
    );
  }
  return parts.join("\n");
}

/** Memória compacta para o chat: sugestões opcionais, sem mandar “dar aula”. */
function formatLearningMemoryForStudyChat(
  lm: LearningMemoryPayload,
  studyContext: unknown
): string {
  const sc =
    studyContext && typeof studyContext === "object"
      ? (studyContext as { topicId?: string | null; topicName?: string | null })
      : null;
  const currentId = sc?.topicId?.trim() || "";
  const weak = Array.isArray(lm.weakTopics) ? lm.weakTopics : [];
  const topWeak = weak[0];
  const trend = lm.trendLabel ?? "unknown";

  const parts: string[] = [];
  parts.push(
    "\n\nContexto opcional para o chat (não invasivo — use só se couber em UMA frase curta após resposta natural):"
  );
  if (topWeak?.topicName?.trim()) {
    parts.push(
      `- Tópico com mais fricção no histórico de quiz (geral): “${topWeak.topicName.trim()}”.`
    );
  }
  if (trend === "improving") {
    parts.push("- Tendência recente no quiz: melhora — pode elogiar de leve se fizer sentido.");
  } else if (trend === "declining") {
    parts.push("- Tendência recente no quiz: queda — tom acolhedor, sem pressionar.");
  }
  if (currentId && lm.currentTopicQuiz && lm.currentTopicQuiz.attempts) {
    const q = lm.currentTopicQuiz;
    parts.push(
      `- Neste tópico aberto agora: ${q.attempts} tentativa(s), ~${q.accuracyPercent ?? "—"}% acerto.`
    );
  }
  parts.push(
    "Regra do chat: NÃO cite estes dados em bloco, NÃO abra explicação longa por causa deles. " +
      "Em conversa casual, cumprimento ou ‘como vai’, NÃO mencione tópico fraco, quiz nem convite para revisar matéria — só seja natural. " +
      "Fora disso, no máximo UMA sugestão (convite ou próximo passo no app, ex.: revisar, questões, dashboard) depois de responder ao que o aluno disse."
  );
  return parts.join("\n");
}

export type LearnerPromptVariant = "default" | "studyChat" | "topicExplanation";

/**
 * Bloco de texto com horas/dia, progresso no catálogo, acertos no quiz e regras pedagógicas
 * ligadas a daysUntilExam (body.examContext) e body.learnerContext do cliente.
 * @param opts.variant studyChat — omite regras de “aula” longa e encurta memória para conversa.
 */
export function formatLearnerContextForPrompt(
  learnerContext: unknown,
  examContext: unknown,
  studyContext?: unknown,
  opts?: { variant?: LearnerPromptVariant }
): string {
  const variant: LearnerPromptVariant = opts?.variant ?? "default";
  const explainVariant = variant === "topicExplanation";
  if (!learnerContext || typeof learnerContext !== "object") return "";
  const lc = learnerContext as {
    hoursPerDay?: number | null;
    topicsStudied?: number | null;
    topicsTotal?: number | null;
    questionsAnswered?: number | null;
    questionsCorrect?: number | null;
    accuracyPercent?: number | null;
    learningMemory?: LearningMemoryPayload | null;
    examReadiness?: ExamReadinessPayload | null;
  };
  const ec =
    examContext && typeof examContext === "object"
      ? (examContext as { daysUntilExam?: number | null })
      : null;
  const days = ec?.daysUntilExam;

  const parts: string[] = [];
  parts.push("\n\nPerfil e progresso do aluno (dados reais do app):");
  if (lc.hoursPerDay != null) {
    parts.push(`- Meta declarada: ~${lc.hoursPerDay} h/dia de estudo.`);
  }
  if (
    lc.topicsStudied != null &&
    lc.topicsTotal != null &&
    lc.topicsTotal > 0
  ) {
    parts.push(
      `- Catálogo do concurso principal: ${lc.topicsStudied} tópico(s) já visitados de ${lc.topicsTotal}.`
    );
  } else if (lc.topicsStudied != null) {
    parts.push(
      `- Tópicos já visitados (concurso principal): ${lc.topicsStudied}.`
    );
  }
  const qa = lc.questionsAnswered ?? 0;
  if (qa > 0) {
    const pct =
      lc.accuracyPercent != null
        ? ` Taxa de acerto aproximada nas questões registradas: ${lc.accuracyPercent}%.`
        : "";
    parts.push(`- Questões do quiz com registro: ${qa} tentativa(s).${pct}`);
  } else if (variant === "studyChat") {
    parts.push("- Questões do quiz: poucas ou nenhuma registrada ainda.");
  } else {
    parts.push(
      "- Questões do quiz: poucas ou nenhuma registrada ainda; favoreça clareza e base sólida."
    );
  }

  if (variant === "studyChat") {
    parts.push(
      "\nQuando você ESTIVER respondendo dúvida ou pedido explícito de conteúdo (não em cumprimentos):"
    );
  } else {
    parts.push("\nComo ajustar sua resposta (obrigatório considerar):");
  }
  if (explainVariant) {
    parts.push(
      "- Você está gerando a explicação canônica deste tópico (texto salvo no app, lido em partes). Priorize os blocos \"NÍVEL ADAPTATIVO DESTA EXPLICAÇÃO\", \"ESTILO DIDÁTICO ADAPTATIVO\" e \"RITMO ADAPTATIVO DA EXPLICAÇÃO\" que aparecem logo após este perfil no mesmo pedido, em conjunto com as regras abaixo."
    );
  }
  if (days !== null && days !== undefined && days >= 0 && days <= 3) {
    parts.push(
      variant === "studyChat"
        ? "- Prazo crítico (0–3 dias): se for ensinar, seja bem objetivo; fora disso, ignore em cumprimentos."
        : "- Prazo crítico (0–3 dias até a prova): priorize síntese, padrões de cobrança, pegadinhas e checklist de revisão; evite teoria longa."
    );
  } else if (days !== null && days !== undefined && days >= 0 && days <= 14) {
    parts.push(
      variant === "studyChat"
        ? "- Prazo curto: se for ensinar, equilibre clareza e revisão rápida."
        : "- Prazo curto (até ~2 semanas): equilibre compreensão com foco no que costuma cair em prova objetiva e revisão rápida."
    );
  } else if (days !== null && days !== undefined && days > 14) {
    parts.push(
      variant === "studyChat"
        ? "- Prazo mais folgado: se for ensinar, pode aprofundar um pouco."
        : "- Prazo mais folgado: pode aprofundar conceitos e exemplos; ainda assim inclua revisão objetiva ao final."
    );
  } else if (days !== null && days !== undefined && days < 0) {
    parts.push(
      variant === "studyChat"
        ? "- Prova informada no passado: tom útil e prático se falar de estudo."
        : "- Data da prova informada já passou: tom útil de reta final ou replanejamento, com síntese prática."
    );
  }

  const acc = lc.accuracyPercent;
  if (acc != null && acc < 58 && qa >= 4) {
    parts.push(
      variant === "studyChat"
        ? "- Quiz com taxa baixa: se for ensinar, linguagem simples e passos curtos."
        : "- Taxa de acerto baixa nas questões registradas: linguagem mais simples, reforçar definições e erros frequentes."
    );
  } else if (acc != null && acc >= 85 && qa >= 5) {
    parts.push(
      variant === "studyChat"
        ? "- Bom desempenho no quiz: se for ensinar, pode ir mais direto ao ponto."
        : "- Bom desempenho nas questões: pode trazer nuances e armadilhas avançadas, sem perder objetividade se o prazo for curto."
    );
  }

  if (variant !== "studyChat") {
    parts.push(
      "- Em \"Como cai na prova\", destaque o que examinadores mais cobram (formato de enunciado, distratores típicos), sem citar edital ou prova específica inventada."
    );
    parts.push(
      "- Se incluir \"Resumo rápido\", entregue texto para relembrar na véspera (telegráfico, fácil de escanear)."
    );
  }

  parts.push(
    variant === "studyChat"
      ? "\nTom no chat: calor humano leve — próxima, com apoio e às vezes um emoji (no máx. um por resposta, se couber); varie aberturas e convites; continue clara e útil, sem tom infantil nem exagerado."
      : explainVariant
        ? "\nTom e postura: professora particular da Yara — conversacional e clara; nunca infantilize. Mesmo no nível mais simples, trate o aluno com respeito adulto. No nível avançado, continue humana (não vire manual técnico frio)."
        : "\nTom e postura: você é um tutor humano, acolhedor e motivador — celebre pequenos progressos, normalize dificuldades e incentive consistência, sem soar artificial ou exagerado."
  );

  const lm = lc.learningMemory;
  if (lm && typeof lm === "object") {
    if (variant === "studyChat") {
      parts.push(formatLearningMemoryForStudyChat(lm as LearningMemoryPayload, studyContext));
    } else {
      parts.push(formatLearningMemoryForPrompt(lm as LearningMemoryPayload, studyContext));
    }
  }

  const er = lc.examReadiness;
  if (er && typeof er === "object") {
    parts.push(formatExamReadinessForPrompt(er as ExamReadinessPayload, explainVariant ? "default" : variant));
  }

  return parts.join("\n");
}

export type TopicExplanationDepth = "base" | "intermediario" | "avancado";

function classifyTopicExplanationDepth(
  learnerContext: unknown,
  studyContext: unknown
): TopicExplanationDepth {
  const sc =
    studyContext && typeof studyContext === "object"
      ? (studyContext as { topicId?: string | null; topicName?: string | null })
      : null;
  const topicId = (sc?.topicId ?? "").trim();
  const topicName = (sc?.topicName ?? "").trim();

  const lc =
    learnerContext && typeof learnerContext === "object"
      ? (learnerContext as {
          learningMemory?: LearningMemoryPayload | null;
          examReadiness?: ExamReadinessPayload | null;
        })
      : null;
  const lm = lc?.learningMemory;
  const er = lc?.examReadiness;

  const weak = Array.isArray(lm?.weakTopics) ? lm.weakTopics! : [];
  const weakRow =
    topicId || topicName
      ? weak.find((w) => {
          if (topicId && w.topicId === topicId) return true;
          const wn = (w.topicName ?? "").trim();
          return Boolean(topicName && wn && wn === topicName);
        })
      : undefined;

  const errInWeak = weakRow?.errors ?? 0;
  const accWeak = weakRow?.accuracyPercent;
  const heavyWeak =
    weakRow != null &&
    (errInWeak >= 3 || (accWeak != null && accWeak < 58));
  const lightWeak =
    weakRow != null &&
    !heavyWeak &&
    (errInWeak >= 1 || (accWeak != null && accWeak < 72));

  const q = lm?.currentTopicQuiz;
  const attempts = q?.attempts ?? 0;
  const wrong = q?.wrong ?? 0;
  const acc = q?.accuracyPercent;

  const wrongRatio = attempts > 0 ? wrong / attempts : 0;

  if (attempts >= 2) {
    if (
      heavyWeak ||
      (acc != null && acc < 60) ||
      wrong >= 3 ||
      (attempts >= 3 && wrongRatio >= 0.42)
    ) {
      return "base";
    }
    const crush =
      acc != null &&
      acc >= 86 &&
      wrong <= Math.max(0, Math.ceil(attempts * 0.18)) &&
      !heavyWeak;
    const solid =
      attempts >= 4 &&
      acc != null &&
      acc >= 80 &&
      wrong <= Math.max(1, Math.floor(attempts * 0.28)) &&
      !heavyWeak;
    if (crush || solid) return "avancado";
    return "intermediario";
  }

  if (heavyWeak) return "base";
  const band = er?.band;
  const trend = lm?.trendLabel;
  if (band === "low") return "base";
  if (trend === "declining" && band !== "high") return "base";
  if (lightWeak && band !== "high") return "base";
  if (band === "high" && !lightWeak && trend !== "declining") return "avancado";
  return "intermediario";
}

/**
 * Instruções de profundidade para generate-topic-explanation (não altera storage nem layout).
 * Usa currentTopicQuiz, weakTopics, tendência e prontidão quando o quiz do tópico ainda é escasso.
 */
export function formatTopicExplanationAdaptiveDepth(
  learnerContext: unknown,
  studyContext: unknown
): string {
  const depth = classifyTopicExplanationDepth(learnerContext, studyContext);

  const base = `- Nível calibrado: **base** (o aluno precisa de mais apoio neste tópico).
- **Introdução** e **Conceito**: linguagem clara e adulta, sem infantilizar; frases curtas; uma ideia por vez; se precisar de termo técnico, defina na hora com uma frase.
- **Exemplo**: prefira dois exemplos curtos ou um exemplo com mini passos (situação típica de prova), em vez de um único bloco denso.
- **Como cai na prova**: foque no que mais confunde e nos distratores clássicos; diga “como o enunciado costuma armar” sem inventar banca.
- Opcional **Erros comuns**: inclua se couber (2–3 confusões bem objetivas).
- Evite pressa moralizante; mantenha tom de professora particular conversacional.`;

  const intermediario = `- Nível calibrado: **intermediário** (evolução — equilíbrio conceito × prova).
- **Introdução**: enxuta (2–4 frases), amarra com utilidade para a prova.
- **Conceito**: núcleo completo mas sem exagero; destaque a lógica que o aluno precisa para não cair em pegadinha.
- **Exemplo**: um exemplo sólido, próximo de prova objetiva.
- **Como cai na prova**: padrões de cobrança + 1–2 armadilhas que aparecem com frequência.
- **Resumo rápido** (opcional): telegráfico, só se agregar para revisão.`;

  const avancado = `- Nível calibrado: **avançado** (o aluno já vai bem neste tópico nas métricas atuais).
- **Introdução**: mínima necessária (1–3 frases), sem redundância motivacional.
- **Conceito**: vá direto ao refinamento, exceções, limites do conceito e comparações finas (onde os alunos fortes ainda erram).
- **Exemplo**: pode ser mais enxuto ou um “caso-limite” que separa alternativas em prova.
- **Como cai na prova**: nuances, distratores sutis, diferença fina entre assertivas — ainda com frases legíveis e tom humano (não seco como manual).
- Não reexplique o óbvio; mantenha conversação clara e foco em prova.`;

  const body =
    depth === "base" ? base : depth === "avancado" ? avancado : intermediario;

  return (
    `\n\nNÍVEL ADAPTATIVO DESTA EXPLICAÇÃO (obrigatório — use como guia principal de profundidade e densidade, mantendo as seções ## obrigatórias):\n` +
    body +
    `\n\n(Lembrete: todas as seções obrigatórias ## continuam obrigatórias; adapte apenas extensão, densidade e ênfase dentro de cada uma.)`
  );
}

/** Metadados do tópico (BD) para calibrar estilo; não altera schema do cliente. */
export type TopicExplanationDidacticHints = {
  topicId?: string | null;
  difficulty?: string | null;
  description?: string | null;
};

function hashTopicId(topicId: string): number {
  let h = 0;
  for (let i = 0; i < topicId.length; i++) {
    h = (h * 31 + topicId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Tom inferido do texto de dificuldade/descrição (heurística leve). */
function inferContentDidacticTone(
  hints: TopicExplanationDidacticHints | undefined
): "abstract" | "procedural" | "neutral" {
  const raw = `${hints?.difficulty ?? ""} ${hints?.description ?? ""}`.toLowerCase();
  if (
    /alta|difícil|dificil|avançad|avancad|complex|árdu|arduo/.test(raw)
  ) {
    return "abstract";
  }
  if (
    /lei|art\.|artigo|norma|decreto|súmula|sumula|jurisprud|preceden|fórmula|formula|cálculo|calculo|passo a passo|algoritmo/.test(
      raw
    )
  ) {
    return "procedural";
  }
  return "neutral";
}

function currentTopicErrorStress(
  learnerContext: unknown,
  studyContext: unknown
): "alto" | "medio" | "baixo" {
  const sc =
    studyContext && typeof studyContext === "object"
      ? (studyContext as { topicId?: string | null; topicName?: string | null })
      : null;
  const topicId = (sc?.topicId ?? "").trim();
  const topicName = (sc?.topicName ?? "").trim();

  const lc =
    learnerContext && typeof learnerContext === "object"
      ? (learnerContext as { learningMemory?: LearningMemoryPayload | null })
      : null;
  const lm = lc?.learningMemory;
  const weak = Array.isArray(lm?.weakTopics) ? lm.weakTopics! : [];
  const weakRow =
    topicId || topicName
      ? weak.find((w) => {
          if (topicId && w.topicId === topicId) return true;
          const wn = (w.topicName ?? "").trim();
          return Boolean(topicName && wn && wn === topicName);
        })
      : undefined;
  const errInWeak = weakRow?.errors ?? 0;
  const accWeak = weakRow?.accuracyPercent;
  const heavyWeak =
    weakRow != null &&
    (errInWeak >= 3 || (accWeak != null && accWeak < 58));

  const q = lm?.currentTopicQuiz;
  const attempts = q?.attempts ?? 0;
  const wrong = q?.wrong ?? 0;
  const acc = q?.accuracyPercent;

  if (heavyWeak || wrong >= 3 || (attempts >= 2 && acc != null && acc < 55)) {
    return "alto";
  }
  if (wrong >= 1 || (attempts >= 2 && acc != null && acc < 68)) {
    return "medio";
  }
  return "baixo";
}

/**
 * Como conduzir o ensino (eixos didáticos), separado da profundidade/densidade.
 * Varia levemente por topicId para não repetir sempre o mesmo estilo entre tópicos.
 */
export function formatTopicExplanationDidacticStyle(
  learnerContext: unknown,
  studyContext: unknown,
  hints?: TopicExplanationDidacticHints
): string {
  const depth = classifyTopicExplanationDepth(learnerContext, studyContext);
  const stress = currentTopicErrorStress(learnerContext, studyContext);
  const tone = inferContentDidacticTone(hints);
  const tid = (hints?.topicId ?? "").trim();
  const rot = tid ? hashTopicId(tid) % 3 : 0;

  const guardrails =
    `- **Regras gerais de estilo (obrigatório):** integre o jeito de ensinar de forma natural — não anuncie técnicas (“agora uma analogia”).\n` +
    `- No máximo **uma** analogia curta e pertinente; nada forçado, infantil ou longe do tema.\n` +
    `- Não empilhe todos os modos (exemplo + analogia + regra + tabela + resumo longo); escolha **1 a 2 eixos principais** e deixe o resto em segundo plano dentro das seções ##.\n` +
    `- Continue com voz da Yara: clara, conversacional, foco em prova.\n`;

  let core = "";

  if (depth === "base") {
    if (stress === "alto" || rot === 2) {
      core =
        `- **Eixos principais desta geração:** **exemplo concreto** + **o que costuma ser certo vs. o que costuma ser armadilha** (contraste curto, adulto).\n` +
        `- Em **Conceito** ou **Exemplo**, deixe explícito “o raciocínio que salva” vs. “o raciocínio que leva ao distrator”.\n` +
        `- **Analogia:** só se couber em **uma** frase e ajudar a desatar um nó; se não couber, omita.\n` +
        `- Opcional **Erros comuns**: útil aqui como mini quadro mental (sem formalismo de tabela obrigatório).\n`;
    } else if (rot === 0) {
      core =
        `- **Eixos principais desta geração:** **exemplo concreto** (situação plausível de prova) + **âncora no intuitivo** (uma imagem mental ou comparação breve, sem exagerar).\n` +
        `- **Introdução** e **Conceito**: construa do simples ao refinamento; **Exemplo** fecha o ciclo com aplicação visível.\n`;
    } else {
      core =
        `- **Eixos principais desta geração:** **exemplo concreto** + **passos curtos** (“primeiro perceba X, depois aplique Y”).\n` +
        `- Prefira microcenas no **Exemplo** em vez de definição só no vácuo.\n` +
        `- **Analogia:** opcional, uma frase, só se destravar confusão frequente.\n`;
    }
  } else if (depth === "intermediario") {
    core =
      `- **Eixos principais desta geração:** **regra prática** (formato se–então, critério ou checklist enxuto) + **aplicação** no **Exemplo**.\n` +
      (rot === 0
        ? `- Coloque o “critério decisório” ainda no **Conceito**; use **Como cai na prova** para mostrar onde o critério quebra ou é testado.\n`
        : rot === 1
          ? `- No **Exemplo**, mostre a **aplicação da regra** a um enunciado-tipo; em **Como cai na prova**, traga **1 padrão de pegadinha** ligado a esse uso.\n`
          : `- Distribua: **Conceito** com a lógica, **Exemplo** com caso típico, **Como cai na prova** com distratores que exploram exceções.\n`);
    if (stress !== "baixo") {
      core +=
        `- Com histórico de mais fricção neste tópico, inclua **um** contraste curto certo/errado (sem tom de prova simulada).\n`;
    }
  } else {
    core =
      `- **Eixos principais desta geração:** **nuance e diferença fina** + **foco em prova** (distratores sutis, limites do conceito, exceções que caem em banca).\n` +
      `- **Introdução** mínima; **Conceito** prioriza refinamento e comparações “A vs. B quase iguais”.\n` +
      (rot === 0
        ? `- **Exemplo**: caso-limite ou duas assertivas quase equivalentes — o que as separa para o correto.\n`
        : `- **Como cai na prova**: laboratório de pegadinhas (sem inventar banca); linguagem ainda humana, não telegráfica demais.\n`) +
      `- Opcional **Resumo rápido**: se usar, seja **telegráfico** (âncoras mentais), sem repetir o **Conceito**.\n`;
  }

  if (tone === "abstract") {
    core +=
      `- **Ajuste pelo tipo de conteúdo (mais denso):** privilegie **regra prática** e **listas curtas** que organizem a cabeça; analogia ainda mais rara.\n`;
  } else if (tone === "procedural") {
    core +=
      `- **Ajuste pelo tipo de conteúdo (procedural/normativo):** privilegie **sequência clara** ou **checklist** na aplicação; mantenha linguagem de prova objetiva.\n`;
  }

  return (
    `\n\nESTILO DIDÁTICO ADAPTATIVO (obrigatório — como conduzir o ensino; independe da densidade do NÍVEL ADAPTATIVO):\n` +
    guardrails +
    core +
    `\n\n(Lembrete: mantenha as seções ## e seus títulos; o estilo se expressa dentro delas, sem criar novos títulos além dos já previstos.)`
  );
}

export type TopicExplanationRhythm = "guiado" | "equilibrado" | "fluido";

/** Tópico aparentemente leve (heurística em dificuldade/descrição). */
function inferTopicFeelsSimple(
  hints: TopicExplanationDidacticHints | undefined
): boolean {
  const raw = `${hints?.difficulty ?? ""} ${hints?.description ?? ""}`.toLowerCase();
  return /baixa|básica|basica|fácil|facil|introdut|noções|nocoes|inicia|fundament/.test(
    raw
  );
}

function classifyTopicExplanationRhythm(
  learnerContext: unknown,
  studyContext: unknown,
  hints?: TopicExplanationDidacticHints
): TopicExplanationRhythm {
  const depth = classifyTopicExplanationDepth(learnerContext, studyContext);
  const stress = currentTopicErrorStress(learnerContext, studyContext);
  const tone = inferContentDidacticTone(hints);
  const simple = inferTopicFeelsSimple(hints);

  const lc =
    learnerContext && typeof learnerContext === "object"
      ? (learnerContext as {
          learningMemory?: LearningMemoryPayload | null;
          examReadiness?: ExamReadinessPayload | null;
        })
      : null;
  const band = lc?.examReadiness?.band;
  const trend = lc?.learningMemory?.trendLabel;

  if (depth === "base") return "guiado";
  if (stress === "alto") return "guiado";
  if (band === "low") return "guiado";
  if (trend === "declining" && depth !== "avancado") return "guiado";
  if (tone === "abstract" && depth !== "avancado") return "guiado";

  if (
    depth === "avancado" &&
    stress === "baixo" &&
    band !== "low" &&
    trend !== "declining"
  ) {
    return tone === "abstract" ? "equilibrado" : "fluido";
  }

  if (
    depth === "intermediario" &&
    stress === "baixo" &&
    band === "high" &&
    simple
  ) {
    return "fluido";
  }

  if (stress === "medio") return "equilibrado";
  return "equilibrado";
}

/**
 * Ritmo de leitura (parágrafos, respiros). Alinha-se à revelação progressiva do app:
 * o cliente parte seções `##` e, quando preciso, subdivide por parágrafos (`\\n\\n`).
 */
export function formatTopicExplanationAdaptiveRhythm(
  learnerContext: unknown,
  studyContext: unknown,
  hints?: TopicExplanationDidacticHints
): string {
  const rhythm = classifyTopicExplanationRhythm(
    learnerContext,
    studyContext,
    hints
  );

  const progressiveNote =
    `- **Leitura progressiva (contexto do app — não cite isso ao aluno):** a explicação aparece em **poucos passos** na conversa; cada título \`## \` costuma virar um passo. ` +
    `Quando o app agrupa conteúdo, **linhas em branco entre parágrafos** delimitam blocos que podem ser fatiados — use isso com critério: **ritmo guiado** → mais parágrafos curtos; **ritmo fluido** → menos quebras desnecessárias. ` +
    `Não crie títulos \`##\` além dos previstos no pedido.\n`;

  const guardrails =
    `- Evite **spam** de micro-frases soltas ou uma frase por linha o tempo todo.\n` +
    `- Ritmo serve ao **conforto** e à clareza, não a um efeito artificial.\n`;

  const guiado =
    `- **Ritmo calibrado: pausado e guiado** (aluno com mais fricção, nível base, prontidão baixa ou conteúdo/tendência pedindo mais apoio).\n` +
    `- Dentro de **cada** seção \`##\`, prefira **vários parágrafos curtos** (cerca de 1–3 frases), separados por **linha em branco**, **uma ideia central por parágrafo**.\n` +
    `- Em **Conceito** e **Exemplo**, deixe “pontos de parada” naturais entre um passo mental e o próximo.\n` +
    `- Transições leves são bem-vindas (“Na prática:”, “O que costuma confundir:”) — sem exagerar nem soar roteirizado.\n`;

  const equilibrado =
    `- **Ritmo calibrado: equilibrado**.\n` +
    `- Parágrafos de **tamanho médio**; use linha em branco ao mudar de sub-tema, sem fragmentar demais.\n` +
    `- **Introdução** e **Como cai na prova** podem ser um pouco mais diretos se o conteúdo pedir.\n`;

  const fluido =
    `- **Ritmo calibrado: fluido e mais direto** (aluno vai bem no tópico ou conteúdo mais leve).\n` +
    `- **Menos** quebras artificiais: junte ideias relacionadas no **mesmo** parágrafo quando soar natural.\n` +
    `- Seções podem ficar **um pouco mais compactas** no conjunto, mantendo clareza e pedagogia.\n` +
    `- Evite sequências de parágrafos de uma única frase, salvo ênfase pontual.\n`;

  const body =
    rhythm === "guiado"
      ? guiado
      : rhythm === "fluido"
        ? fluido
        : equilibrado;

  return (
    `\n\nRITMO ADAPTATIVO DA EXPLICAÇÃO (obrigatório — “respiros” e cadência de leitura; complementa profundidade e estilo didático):\n` +
    progressiveNote +
    guardrails +
    body +
    `\n\n(Lembrete: seções ## obrigatórias inalteradas; ajuste só parágrafos, transições e densidade.)`
  );
}
