import { sanitizeOpenTopicHints } from "./yaraActions.js";
import {
  applyBancaAwareTrapToPredictedRisk,
  applyBancaAwareTrapToSubjectPedagogy,
  inferBancaAwareTrap,
} from "./bancaAwareTraps.js";
import { hasMeaningfulLearningFeedback, normalizeLearningFeedback } from "./learningFeedbackLoop.js";
import {
  applySubjectPedagogyToLearningFeedback,
  applySubjectPedagogyToPredictedRisk,
  inferSubjectPedagogy,
} from "./subjectPedagogy.js";
import { buildNextBestActionPayload, buildPredictedRiskPayload } from "./topicRiskProfile.js";

/**
 * @param {string | null | undefined} examDateStr ISO date YYYY-MM-DD
 * @returns {number | null} dias até a data (negativo = prova no passado)
 */
export function computeDaysUntilExam(examDateStr) {
  if (!examDateStr || typeof examDateStr !== "string") return null;
  const parts = examDateStr.trim().split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const target = new Date(y, m, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function examCountdownLabel(examDateStr) {
  const days = computeDaysUntilExam(examDateStr);
  if (days === null) return null;
  if (days < 0) return `Sua prova era há ${Math.abs(days)} dia(s) (${examDateStr}).`;
  if (days === 0) return "Sua prova é hoje. Boa sorte!";
  return `Faltam ${days} dia(s) para sua prova (${examDateStr}).`;
}

/**
 * Objeto enviado nas Edge Functions (explicação, chat, questões).
 */
export function buildExamContextPayload(examDateStr) {
  if (!examDateStr?.trim()) return {};
  const daysUntilExam = computeDaysUntilExam(examDateStr.trim());
  const label =
    daysUntilExam === null
      ? ""
      : daysUntilExam < 0
        ? `A data da prova informada (${examDateStr}) já passou (${Math.abs(daysUntilExam)} dia(s) atrás).`
        : daysUntilExam === 0
          ? "A prova do aluno é hoje."
          : `Faltam ${daysUntilExam} dia(s) até a prova do aluno (data: ${examDateStr}).`;

  return {
    examContext: {
      examDate: examDateStr.trim(),
      daysUntilExam,
      label,
    },
  };
}

/**
 * Enriquece learningMemory com estatísticas do tópico atual (mapa só no cliente; removido antes do envio).
 * @param {Record<string, unknown> | null | undefined} raw
 * @param {string | null | undefined} topicId
 * @param {Record<string, { total?: number, wrong?: number, accuracyPercent?: number | null }> | null | undefined} statsById
 */
export function mergeLearningMemoryForTopicQuiz(raw, topicId, statsById) {
  if (!raw || typeof raw !== "object") return raw;
  const lm = raw.learningMemory;
  if (!lm || typeof lm !== "object") return raw;
  const tid = typeof topicId === "string" && topicId.trim() ? topicId.trim() : null;
  if (!tid) return raw;
  const s = statsById && typeof statsById === "object" ? statsById[tid] : null;
  const hasQuiz = s && typeof s.total === "number" && s.total > 0;
  return {
    ...raw,
    learningMemory: {
      ...lm,
      currentTopicId: tid,
      ...(hasQuiz
        ? {
            currentTopicQuiz: {
              attempts: Math.min(5000, Math.max(0, Math.floor(s.total))),
              wrong: Math.min(5000, Math.max(0, Math.floor(s.wrong ?? 0))),
              accuracyPercent:
                s.accuracyPercent == null
                  ? null
                  : Math.min(100, Math.max(0, Math.round(Number(s.accuracyPercent)))),
            },
          }
        : {}),
    },
  };
}

/**
 * @param {unknown} raw
 */
export function normalizeLearningMemoryForPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lm = raw;
  const weakTopics = Array.isArray(lm.weakTopics)
    ? lm.weakTopics.slice(0, 6).map((w) => ({
        topicId: typeof w.topicId === "string" ? w.topicId.slice(0, 80) : "",
        topicName: typeof w.topicName === "string" ? w.topicName.slice(0, 120) : "",
        errors: Math.min(999, Math.max(0, Math.floor(Number(w.errors) || 0))),
        attempts: Math.min(999, Math.max(0, Math.floor(Number(w.attempts) || 0))),
        accuracyPercent:
          w.accuracyPercent == null
            ? null
            : Math.min(100, Math.max(0, Math.round(Number(w.accuracyPercent)))),
      }))
    : [];
  const recentWrongHints = Array.isArray(lm.recentWrongHints)
    ? lm.recentWrongHints.slice(0, 4).map((h) => ({
        topicName: typeof h.topicName === "string" ? h.topicName.slice(0, 120) : "",
        stemPreview: typeof h.stemPreview === "string" ? h.stemPreview.slice(0, 200) : "",
      }))
    : [];
  const recentStudyTopics = Array.isArray(lm.recentStudyTopics)
    ? lm.recentStudyTopics
        .slice(0, 12)
        .map((r) => ({
          topicId: typeof r.topicId === "string" ? r.topicId.trim().slice(0, 80) : "",
          topicName: typeof r.topicName === "string" ? r.topicName.trim().slice(0, 120) : "",
        }))
        .filter((r) => r.topicId)
    : [];
  const trendOk = ["improving", "declining", "stable", "unknown"].includes(lm.trendLabel);
  const trendLabel = trendOk ? lm.trendLabel : "unknown";

  const currentTopicQuiz =
    lm.currentTopicQuiz && typeof lm.currentTopicQuiz === "object"
      ? {
          attempts: Math.min(
            5000,
            Math.max(0, Math.floor(Number(lm.currentTopicQuiz.attempts) || 0))
          ),
          wrong: Math.min(5000, Math.max(0, Math.floor(Number(lm.currentTopicQuiz.wrong) || 0))),
          accuracyPercent:
            lm.currentTopicQuiz.accuracyPercent == null
              ? null
              : Math.min(100, Math.max(0, Math.round(Number(lm.currentTopicQuiz.accuracyPercent)))),
        }
      : null;

  const currentTopicId =
    typeof lm.currentTopicId === "string" && lm.currentTopicId.trim()
      ? lm.currentTopicId.trim().slice(0, 80)
      : null;

  const out = {
    studyDaysLast14: Math.min(14, Math.max(0, Math.floor(Number(lm.studyDaysLast14) || 0))),
    studyDaysLast7: Math.min(7, Math.max(0, Math.floor(Number(lm.studyDaysLast7) || 0))),
    quizAttemptsInScope: Math.min(5000, Math.max(0, Math.floor(Number(lm.quizAttemptsInScope) || 0))),
    globalAccuracyPercent:
      lm.globalAccuracyPercent == null
        ? null
        : Math.min(100, Math.max(0, Math.round(Number(lm.globalAccuracyPercent)))),
    accuracyLast7dPercent:
      lm.accuracyLast7dPercent == null
        ? null
        : Math.min(100, Math.max(0, Math.round(Number(lm.accuracyLast7dPercent)))),
    accuracyPrev7dPercent:
      lm.accuracyPrev7dPercent == null
        ? null
        : Math.min(100, Math.max(0, Math.round(Number(lm.accuracyPrev7dPercent)))),
    trendLabel,
    weakTopics,
    recentWrongHints,
  };
  if (currentTopicId) out.currentTopicId = currentTopicId;
  if (currentTopicQuiz) out.currentTopicQuiz = currentTopicQuiz;
  if (recentStudyTopics.length) out.recentStudyTopics = recentStudyTopics;

  const hasSignal =
    out.quizAttemptsInScope > 0 ||
    out.studyDaysLast14 > 0 ||
    weakTopics.length > 0 ||
    recentWrongHints.length > 0 ||
    recentStudyTopics.length > 0 ||
    Boolean(currentTopicId);
  return hasSignal ? out : null;
}

/**
 * Normaliza métricas do app para o payload da IA (concurso principal + quiz).
 * @param {Record<string, unknown> | null | undefined} raw
 */
/**
 * @param {unknown} er
 */
function sanitizeExamReadinessForPayload(er) {
  if (!er || typeof er !== "object") return null;
  const score = Math.min(100, Math.max(0, Math.round(Number(/** @type {{ score?: unknown }} */ (er).score))));
  if (!Number.isFinite(score)) return null;
  const bandRaw = /** @type {{ band?: unknown }} */ (er).band;
  const band =
    bandRaw === "low" || bandRaw === "medium" || bandRaw === "high" ? bandRaw : null;
  if (!band) return null;
  const label = String(/** @type {{ label?: unknown }} */ (er).label ?? "").slice(0, 96);
  const headline = String(/** @type {{ headline?: unknown }} */ (er).headline ?? "").slice(0, 220);
  const coachHint = String(/** @type {{ coachHint?: unknown }} */ (er).coachHint ?? "").slice(0, 400);
  const bulletsIn = /** @type {{ bullets?: unknown }} */ (er).bullets;
  const bullets = Array.isArray(bulletsIn)
    ? bulletsIn
        .map((b) => (typeof b === "string" ? b.trim().slice(0, 280) : ""))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return { score, band, label, headline, bullets, coachHint };
}

export function normalizeLearnerMetrics(raw) {
  if (!raw || typeof raw !== "object") return null;
  const {
    topicQuizStatsByTopicId: _dropStats,
    openTopicHints: _dropOpenHints,
    examReadiness: rawExamReadiness,
    ...rest
  } = raw;
  const hoursRaw = rest.hoursPerDay;
  let hoursPerDay = null;
  if (hoursRaw != null && hoursRaw !== "") {
    const n = Number(String(hoursRaw).replace("+", "").trim());
    hoursPerDay = Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 10) / 10, 12) : null;
  }
  const ts = Number(rest.topicsStudied);
  const tt = Number(rest.topicsTotal);
  const qa = Number(rest.questionsAnswered);
  const qc = Number(rest.questionsCorrect);
  const topicsStudied = Number.isFinite(ts) ? Math.max(0, Math.floor(ts)) : null;
  const topicsTotal = Number.isFinite(tt) ? Math.max(0, Math.floor(tt)) : null;
  const questionsAnswered = Number.isFinite(qa) ? Math.max(0, Math.floor(qa)) : null;
  const questionsCorrect = Number.isFinite(qc) ? Math.max(0, Math.floor(qc)) : null;
  let accuracy = null;
  let accuracyPercent = null;
  if (questionsAnswered != null && questionsAnswered > 0 && questionsCorrect != null) {
    accuracy = Math.min(1, questionsCorrect / questionsAnswered);
    accuracyPercent = Math.round(accuracy * 100);
  }
  const learningMemory = normalizeLearningMemoryForPayload(rest.learningMemory);
  const examReadiness = sanitizeExamReadinessForPayload(rawExamReadiness);

  const hasAny =
    hoursPerDay != null ||
    topicsStudied != null ||
    topicsTotal != null ||
    (questionsAnswered != null && questionsAnswered > 0) ||
    Boolean(learningMemory) ||
    Boolean(examReadiness);
  if (!hasAny) return null;
  return {
    hoursPerDay,
    topicsStudied,
    topicsTotal,
    questionsAnswered: questionsAnswered ?? 0,
    questionsCorrect: questionsCorrect ?? 0,
    accuracy,
    accuracyPercent,
    ...(learningMemory ? { learningMemory } : {}),
    ...(examReadiness ? { examReadiness } : {}),
  };
}

/**
 * Contexto completo para Edge Functions: prova + catálogo + progresso do aluno.
 * @param {Record<string, unknown> | null | undefined} [learnerMetricsRaw]
 * @param {{ flowMoment?: "explanation" | "chat" | "pre_questions" | "post_explanation", studySessionContext?: Record<string, unknown> | null, learningFeedback?: Record<string, unknown> | null }} [options]
 */
export function buildFullAiPayload(examDateStr, contest, subject, topic, learnerMetricsRaw, options) {
  const base = buildExamContextPayload(examDateStr);
  const contestName = contest?.name?.trim() || null;
  const subjectName = subject?.name?.trim() || null;
  const topicName = topic?.name?.trim() || null;
  const topicId = topic?.id && typeof topic.id === "string" ? topic.id : null;
  const statsById =
    learnerMetricsRaw && typeof learnerMetricsRaw === "object"
      ? learnerMetricsRaw.topicQuizStatsByTopicId
      : null;
  const mergedLearner = mergeLearningMemoryForTopicQuiz(learnerMetricsRaw, topicId, statsById);
  const learnerContext = normalizeLearnerMetrics(mergedLearner);
  const topicStats =
    topicId && statsById && typeof statsById === "object" ? statsById[topicId] : null;
  const rawLearningFeedback = normalizeLearningFeedback(options?.learningFeedback ?? null);
  const initialSubjectPedagogy = inferSubjectPedagogy({
    subjectName,
    topicName,
    learningFeedback: rawLearningFeedback,
  });
  const learningFeedback = applySubjectPedagogyToLearningFeedback(
    rawLearningFeedback,
    initialSubjectPedagogy
  );
  const rawPredictedRisk =
    topicId && (mergedLearner?.learningMemory || topicStats || learnerMetricsRaw?.examReadiness)
      ? buildPredictedRiskPayload(
          topicId,
          mergedLearner?.learningMemory ?? null,
          topicStats,
          learnerMetricsRaw?.examReadiness,
          learningFeedback
        )
      : null;
  const subjectPedagogyBase = inferSubjectPedagogy({
    subjectName,
    topicName,
    predictedRisk: rawPredictedRisk,
    learningFeedback,
  });
  const subjectPedagogyWithTrapBase = subjectPedagogyBase;
  const predictedRiskWithSubjectPedagogy = applySubjectPedagogyToPredictedRisk(
    rawPredictedRisk,
    subjectPedagogyWithTrapBase,
    learningFeedback
  );
  const bancaAwareTrap = inferBancaAwareTrap({
    contestName,
    subjectName,
    topicName,
    subjectPedagogy: subjectPedagogyWithTrapBase,
    predictedRisk: predictedRiskWithSubjectPedagogy,
    learningFeedback,
  });
  const subjectPedagogy = applyBancaAwareTrapToSubjectPedagogy(
    subjectPedagogyWithTrapBase,
    bancaAwareTrap
  );
  const predictedRisk = applyBancaAwareTrapToPredictedRisk(
    predictedRiskWithSubjectPedagogy,
    bancaAwareTrap
  );
  const nextBestAction = buildNextBestActionPayload(
    predictedRisk,
    options?.studySessionContext ?? null,
    options?.flowMoment ?? "chat",
    learningFeedback,
    subjectPedagogy,
    bancaAwareTrap
  );

  const out = { ...base };
  if (contestName || subjectName || topicName || topicId) {
    out.studyContext = {
      contestName,
      subjectName,
      topicName,
      ...(topicId ? { topicId } : {}),
    };
  }
  if (learnerContext) {
    out.learnerContext = learnerContext;
  }
  if (subjectPedagogy?.subjectMode) {
    out.subjectPedagogy = subjectPedagogy;
  }
  if (bancaAwareTrap?.trapStyle) {
    out.bancaAwareTrap = bancaAwareTrap;
  }
  if (predictedRisk && predictedRisk.level !== "low") {
    out.predictedRisk = {
      level: predictedRisk.level,
      reason: predictedRisk.reason,
      weakFocus: predictedRisk.weakFocus,
      likelyMistake: predictedRisk.likelyMistake,
      interventionStyle: predictedRisk.interventionStyle,
      meta: predictedRisk.meta,
      subjectMode: predictedRisk.subjectMode,
      domainSpecialization: predictedRisk.domainSpecialization,
      bancaStyle: predictedRisk.bancaStyle,
      trapStyle: predictedRisk.trapStyle,
    };
  }
  if (hasMeaningfulLearningFeedback(learningFeedback)) {
    out.learningFeedback = learningFeedback;
  }
  if (nextBestAction?.action) {
    out.nextBestAction = nextBestAction;
  }
  const hints = sanitizeOpenTopicHints(
    learnerMetricsRaw && typeof learnerMetricsRaw === "object" ? learnerMetricsRaw.openTopicHints : null
  );
  if (hints.length) {
    out.openTopicHints = hints;
  }
  return out;
}
