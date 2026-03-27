const DEFAULT_STATE = Object.freeze({
  phase: "learning",
  confidence: "medium",
  lastUserIntent: "idle",
  loopCount: 0,
});

const PHASES = new Set(["learning", "checking", "practice", "review"]);
const CONFIDENCE_LEVELS = ["low", "medium", "high"];
const USER_INTENTS = new Set(["doubt", "confirmation", "stuck", "idle"]);

function clampLoopCount(value) {
  const n = Math.floor(Number(value) || 0);
  return Math.min(9, Math.max(0, n));
}

function normalizePhase(value) {
  return PHASES.has(value) ? value : DEFAULT_STATE.phase;
}

function normalizeConfidence(value) {
  return CONFIDENCE_LEVELS.includes(value) ? value : DEFAULT_STATE.confidence;
}

function normalizeIntent(value) {
  return USER_INTENTS.has(value) ? value : DEFAULT_STATE.lastUserIntent;
}

function raiseConfidence(value) {
  const index = CONFIDENCE_LEVELS.indexOf(normalizeConfidence(value));
  return CONFIDENCE_LEVELS[Math.min(CONFIDENCE_LEVELS.length - 1, index + 1)];
}

function lowerConfidence(value) {
  const index = CONFIDENCE_LEVELS.indexOf(normalizeConfidence(value));
  return CONFIDENCE_LEVELS[Math.max(0, index - 1)];
}

function normalizeMessageText(message) {
  return String(message ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isShortIdleMessage(raw, normalized) {
  if (!normalized || normalized.includes("?")) return false;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length <= 3 || raw.trim().length <= 18;
}

function isQuestionLike(normalized) {
  return (
    normalized.includes("?") ||
    /^(como|por que|porque|qual|quais|quando|onde|quem|quanto|quantos|sera|sera que|isso|entao|então)\b/.test(
      normalized
    ) ||
    /\b(como|por que|porque|qual|quais|quando|onde|quem|duvida|dúvida)\b/.test(normalized)
  );
}

/**
 * Heurística leve de intenção do aluno, sem NLP pesado.
 * @param {string} message
 * @returns {"doubt" | "confirmation" | "stuck" | "idle"}
 */
export function detectUserIntent(message) {
  const raw = String(message ?? "");
  const text = normalizeMessageText(raw);

  if (!text) return "idle";

  if (
    /(nao entendi|nao estou entendendo|to perdido|tô perdido|estou perdido|me perdi|trav(ei|ado)|confuso|boiei|nao saquei|nao consegui acompanhar)/.test(
      text
    )
  ) {
    return "stuck";
  }

  if (
    /(acho que entendi|agora entendi|entendi agora|entendi|agora fez sentido|fez sentido|saquei|acho que peguei|peguei a ideia|deu pra entender)/.test(
      text
    )
  ) {
    return "confirmation";
  }

  if (isQuestionLike(text)) return "doubt";
  if (isShortIdleMessage(raw, text)) return "idle";

  return "doubt";
}

/**
 * @param {unknown} raw
 */
export function normalizeStudySessionState(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATE };
  return {
    phase: normalizePhase(raw.phase),
    confidence: normalizeConfidence(raw.confidence),
    lastUserIntent: normalizeIntent(raw.lastUserIntent),
    loopCount: clampLoopCount(raw.loopCount),
  };
}

/**
 * Atualiza o estado dinâmico da sessão de estudo.
 * @param {unknown} prevState
 * @param {"doubt" | "confirmation" | "stuck" | "idle"} intent
 * @param {{
 *   recentErrors?: number,
 *   quizAnswered?: number,
 *   currentSubTab?: "explanation" | "questions" | "chat",
 *   lastAssistantActionType?: string | null,
 * }} [context]
 */
export function updateStudySessionState(prevState, intent, context = {}) {
  const prev = normalizeStudySessionState(prevState);
  const safeIntent = normalizeIntent(intent);
  const recentErrors = Math.max(0, Math.floor(Number(context.recentErrors) || 0));
  const quizAnswered = Math.max(0, Math.floor(Number(context.quizAnswered) || 0));
  const currentSubTab = context.currentSubTab === "questions" ? "questions" : "explanation";
  const lastAssistantActionType =
    typeof context.lastAssistantActionType === "string" ? context.lastAssistantActionType.trim() : "";

  let phase = prev.phase;
  let confidence = prev.confidence;

  if (recentErrors >= 2) {
    phase = "learning";
    confidence = "low";
  } else if (safeIntent === "stuck") {
    phase = "learning";
    confidence = "low";
  } else if (currentSubTab === "questions" || lastAssistantActionType === "open_questions") {
    phase = recentErrors > 0 ? "review" : "practice";
    if (recentErrors === 0 && quizAnswered > 0 && confidence === "low") {
      confidence = "medium";
    }
  } else if (safeIntent === "confirmation") {
    phase = prev.phase === "learning" ? "checking" : prev.phase === "checking" ? "practice" : prev.phase;
    confidence = raiseConfidence(prev.confidence);
  } else if (safeIntent === "doubt") {
    phase = prev.phase === "practice" ? "checking" : prev.phase;
    confidence = prev.confidence === "high" ? "medium" : prev.confidence;
  } else if (safeIntent === "idle" && prev.loopCount >= 2) {
    confidence = lowerConfidence(prev.confidence);
  }

  const sameIntent = prev.lastUserIntent === safeIntent;
  const loopingIntent = safeIntent === "stuck" || safeIntent === "doubt" || safeIntent === "idle";
  let loopCount = 0;

  if (safeIntent === "confirmation") {
    loopCount = Math.max(0, prev.loopCount - 1);
  } else if (loopingIntent && sameIntent) {
    loopCount = prev.loopCount + 1;
  } else if (loopingIntent && phase === prev.phase) {
    loopCount = prev.loopCount + 1;
  }

  if (recentErrors >= 2) {
    loopCount = Math.max(loopCount, prev.loopCount + 1);
  }

  loopCount = clampLoopCount(loopCount);

  if (loopCount >= 3) {
    if (phase === "learning") {
      phase = "checking";
    } else if (phase === "checking") {
      phase = recentErrors > 0 ? "review" : "practice";
    } else if (phase === "practice") {
      phase = recentErrors > 0 ? "review" : "learning";
    }
  }

  if (quizAnswered >= 3 && recentErrors === 0 && safeIntent === "confirmation") {
    phase = "review";
    confidence = "high";
  }

  return {
    phase: normalizePhase(phase),
    confidence: normalizeConfidence(confidence),
    lastUserIntent: safeIntent,
    loopCount,
  };
}

export function createDefaultStudySessionState() {
  return { ...DEFAULT_STATE };
}
