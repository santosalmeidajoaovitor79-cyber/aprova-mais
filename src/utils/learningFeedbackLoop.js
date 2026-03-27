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

export function createDefaultLearningFeedback() {
  return {
    explanationHelpfulness: "",
    confusionSource: "",
    preventiveHintWorked: "",
    studentConfidence: "",
    preferredNextMove: "",
    feedbackSignals: [],
  };
}

export function normalizeLearningFeedback(raw) {
  if (!raw || typeof raw !== "object") return createDefaultLearningFeedback();
  return {
    explanationHelpfulness: typeof raw.explanationHelpfulness === "string" ? raw.explanationHelpfulness.trim() : "",
    confusionSource: typeof raw.confusionSource === "string" ? raw.confusionSource.trim() : "",
    preventiveHintWorked: typeof raw.preventiveHintWorked === "string" ? raw.preventiveHintWorked.trim() : "",
    studentConfidence: typeof raw.studentConfidence === "string" ? raw.studentConfidence.trim() : "",
    preferredNextMove: typeof raw.preferredNextMove === "string" ? raw.preferredNextMove.trim() : "",
    feedbackSignals: uniq(raw.feedbackSignals, 10),
  };
}

export function hasMeaningfulLearningFeedback(raw) {
  const fb = normalizeLearningFeedback(raw);
  return Boolean(
    fb.explanationHelpfulness ||
      fb.confusionSource ||
      fb.preventiveHintWorked ||
      fb.studentConfidence ||
      fb.preferredNextMove ||
      fb.feedbackSignals.length
  );
}

export function mergeLearningFeedback(prev, ...patches) {
  const base = normalizeLearningFeedback(prev);
  const merged = { ...base };
  const signals = [...base.feedbackSignals];

  for (const patch of patches) {
    if (!patch || typeof patch !== "object") continue;
    const next = normalizeLearningFeedback(patch);
    if (next.explanationHelpfulness) merged.explanationHelpfulness = next.explanationHelpfulness;
    if (next.confusionSource) merged.confusionSource = next.confusionSource;
    if (next.preventiveHintWorked) merged.preventiveHintWorked = next.preventiveHintWorked;
    if (next.studentConfidence) merged.studentConfidence = next.studentConfidence;
    if (next.preferredNextMove) merged.preferredNextMove = next.preferredNextMove;
    signals.push(...next.feedbackSignals);
  }

  merged.feedbackSignals = uniq(signals, 10);
  return merged;
}

export function inferExplicitLearningFeedback(message) {
  const text = normalizeText(message);
  if (!text) return createDefaultLearningFeedback();

  const out = createDefaultLearningFeedback();
  const signals = [];

  if (/(isso ajudou|agora ajudou|agora fez sentido|agora entendi|isso fez sentido)/.test(text)) {
    out.explanationHelpfulness = "helped";
    signals.push("explicit_helped");
  } else if (/(nao ajudou|nao me ajudou|ainda nao entendi|continuo confuso|ainda to perdido)/.test(text)) {
    out.explanationHelpfulness = "not_helped";
    signals.push("explicit_not_helped");
  } else if (/(mais ou menos|quase entendi|entendi parcialmente)/.test(text)) {
    out.explanationHelpfulness = "partial";
    signals.push("explicit_partial");
  }

  if (/\b(conceito|teoria|base|regra)\b/.test(text)) {
    out.confusionSource = "concept";
    signals.push("explicit_concept_confusion");
  } else if (/\b(enunciado|comando|pergunta)\b/.test(text)) {
    out.confusionSource = "enunciado";
    signals.push("explicit_enunciado_confusion");
  } else if (/\b(alternativa|alternativas|opcao|opcoes|resposta)\b/.test(text)) {
    out.confusionSource = "alternatives";
    signals.push("explicit_alternative_confusion");
  }

  if (/(essa dica ajudou|esse alerta ajudou|essa pista ajudou)/.test(text)) {
    out.preventiveHintWorked = "yes";
    signals.push("explicit_hint_worked");
  } else if (/(a dica nao ajudou|o alerta nao ajudou|mesmo com a dica errei)/.test(text)) {
    out.preventiveHintWorked = "no";
    signals.push("explicit_hint_failed");
  }

  if (/(to seguro|estou seguro|tenho certeza|agora estou confiante)/.test(text)) {
    out.studentConfidence = "high";
    signals.push("explicit_high_confidence");
  } else if (/(acho que entendi|acho que peguei|talvez eu tenha entendido)/.test(text)) {
    out.studentConfidence = "medium";
    signals.push("explicit_medium_confidence");
  } else if (/(nao entendi|to perdido|estou inseguro|nao tenho certeza)/.test(text)) {
    out.studentConfidence = "low";
    signals.push("explicit_low_confidence");
  }

  if (/\b(simplifica|simplificar|mais simples|explica mais simples)\b/.test(text)) {
    out.preferredNextMove = "simplify";
    signals.push("explicit_pref_simplify");
  } else if (/\b(contrasta|comparar|diferenca|diferenca entre)\b/.test(text)) {
    out.preferredNextMove = "contrast";
    signals.push("explicit_pref_contrast");
  } else if (/\b(exemplo|exemplificar|caso pratico)\b/.test(text)) {
    out.preferredNextMove = "example";
    signals.push("explicit_pref_example");
  } else if (/\b(questoes|questao|praticar|vamos praticar|bora pras questoes)\b/.test(text)) {
    out.preferredNextMove = "practice";
    signals.push("explicit_pref_practice");
  } else if (/\b(revisar a base|volta do comeco|do zero|revisar o basico)\b/.test(text)) {
    out.preferredNextMove = "review_base";
    signals.push("explicit_pref_review_base");
  }

  out.feedbackSignals = uniq(signals, 6);
  return out;
}

export function inferImplicitLearningFeedbackFromMessage(message, context = {}) {
  const text = normalizeText(message);
  const intent = typeof context.intent === "string" ? context.intent.trim() : "";
  const out = createDefaultLearningFeedback();
  const signals = [];

  if (!text) return out;

  if (intent === "stuck") {
    out.studentConfidence = "low";
    out.explanationHelpfulness = out.explanationHelpfulness || "not_helped";
    signals.push("implicit_stuck");
  } else if (intent === "confirmation") {
    out.studentConfidence = "medium";
    out.explanationHelpfulness = out.explanationHelpfulness || "helped";
    signals.push("implicit_confirmation");
  }

  if (/\b(exemplo|exemplifica|caso pratico)\b/.test(text)) {
    out.preferredNextMove = "example";
    signals.push("implicit_wants_example");
  }
  if (/\b(questoes|questao|praticar|vamos pra pratica|bora pras questoes)\b/.test(text)) {
    out.preferredNextMove = "practice";
    signals.push("implicit_accepts_practice");
  }
  if (/\b(contrasta|compara|qual a diferenca|diferenca entre)\b/.test(text)) {
    out.preferredNextMove = "contrast";
    signals.push("implicit_wants_contrast");
  }
  if (/\b(simplifica|mais simples|explica de novo)\b/.test(text)) {
    out.preferredNextMove = "simplify";
    out.explanationHelpfulness = out.explanationHelpfulness || "partial";
    signals.push("implicit_reexplain");
  }

  out.feedbackSignals = uniq(signals, 6);
  return out;
}

export function inferImplicitLearningFeedbackFromQuiz(params = {}) {
  const out = createDefaultLearningFeedback();
  const signals = [];
  const isCorrect = params.isCorrect === true;
  const preferredNextMove =
    typeof params.preferredNextMove === "string" ? params.preferredNextMove.trim() : "";
  const confidence = typeof params.studentConfidence === "string" ? params.studentConfidence.trim() : "";

  if (isCorrect) {
    out.studentConfidence = confidence === "low" ? "medium" : confidence || "high";
    if (preferredNextMove === "practice") {
      out.preventiveHintWorked = "yes";
      signals.push("implicit_practice_worked");
    }
  } else {
    out.studentConfidence = "low";
    if (preferredNextMove === "practice") {
      out.preventiveHintWorked = "no";
      signals.push("implicit_missed_after_practice");
    } else {
      signals.push("implicit_quiz_error");
    }
  }

  out.feedbackSignals = uniq(signals, 4);
  return out;
}
