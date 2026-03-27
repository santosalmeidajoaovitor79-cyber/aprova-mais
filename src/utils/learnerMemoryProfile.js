/** @typedef {{ topic_id: string, is_correct: boolean, attempted_at: string }} QuizAttemptRow */
/** @typedef {{ topic_id?: string | null, visited_at: string }} VisitRow */

const DAY_MS = 86400000;

/**
 * @param {number[]} timestampsMs
 * @returns {number}
 */
function distinctLocalDays(timestampsMs) {
  const set = new Set();
  for (const t of timestampsMs) {
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    set.add(d.getTime());
  }
  return set.size;
}

/**
 * @param {string | null | undefined} stem
 * @param {number} max
 */
export function truncateStemPreview(stem, max = 120) {
  if (!stem || typeof stem !== "string") return "";
  const t = stem.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * @param {QuizAttemptRow[]} attempts — já filtradas ao escopo (ex.: tópicos do concurso)
 * @param {{ min: number, max: number }} windowDays — faixa de idade em dias (agora como 0)
 * @param {number} nowMs
 * @returns {number | null}
 */
export function accuracyInDayWindow(attempts, windowDays, nowMs) {
  const slice = attempts.filter((a) => {
    const t = Date.parse(a.attempted_at);
    if (!Number.isFinite(t)) return false;
    const ageDays = (nowMs - t) / DAY_MS;
    return ageDays >= windowDays.min && ageDays < windowDays.max;
  });
  if (!slice.length) return null;
  const correct = slice.filter((a) => a.is_correct).length;
  return Math.round((correct / slice.length) * 100);
}

/**
 * @param {number | null} last7
 * @param {number | null} prev7
 * @returns {'improving' | 'declining' | 'stable' | 'unknown'}
 */
export function classifyTrend(last7, prev7) {
  if (last7 == null || prev7 == null) return "unknown";
  const diff = last7 - prev7;
  if (diff >= 8) return "improving";
  if (diff <= -8) return "declining";
  return "stable";
}

/**
 * Agrega tentativas por tópico (escopo já filtrado no cliente).
 * @param {QuizAttemptRow[]} attempts
 * @returns {Map<string, { total: number, correct: number, wrong: number, accuracyPercent: number | null }>}
 */
export function aggregateAttemptsByTopic(attempts) {
  const map = new Map();
  for (const a of attempts) {
    const id = a.topic_id;
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, { total: 0, correct: 0, wrong: 0, accuracyPercent: null });
    }
    const e = map.get(id);
    e.total += 1;
    if (a.is_correct) e.correct += 1;
    else e.wrong += 1;
  }
  for (const e of map.values()) {
    e.accuracyPercent = e.total > 0 ? Math.round((e.correct / e.total) * 100) : null;
  }
  return map;
}

/**
 * @param {Map<string, { total: number, correct: number, wrong: number, accuracyPercent: number | null }>} byTopic
 * @param {Record<string, string>} topicNamesById
 * @param {number} [limit=5]
 */
/**
 * Ordem de tópicos visitados neste concurso (mais recente primeiro), limitado.
 * @param {VisitRow[]} visits
 * @param {Set<string> | string[]} validTopicIds
 * @param {number} [limit=14]
 * @returns {string[]}
 */
export function deriveRecentTopicIdsFromVisits(visits, validTopicIds, limit = 14) {
  const set =
    validTopicIds instanceof Set
      ? validTopicIds
      : new Set(Array.isArray(validTopicIds) ? validTopicIds.filter(Boolean) : []);
  const lastByTopic = new Map();
  for (const v of visits || []) {
    const tid = typeof v?.topic_id === "string" ? v.topic_id.trim() : "";
    if (!tid || !set.has(tid)) continue;
    const t = Date.parse(v.visited_at);
    if (!Number.isFinite(t)) continue;
    const prev = lastByTopic.get(tid);
    if (prev == null || t > prev) lastByTopic.set(tid, t);
  }
  return [...lastByTopic.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, Math.max(1, limit));
}

export function pickWeakTopicsForPrompt(byTopic, topicNamesById, limit = 5) {
  const rows = [];
  for (const [topicId, e] of byTopic) {
    if (e.total < 2) continue;
    rows.push({
      topicId,
      topicName: topicNamesById[topicId]?.trim() || "Tópico",
      errors: e.wrong,
      attempts: e.total,
      accuracyPercent: e.accuracyPercent,
    });
  }
  rows.sort(
    (a, b) =>
      b.errors - a.errors || (a.accuracyPercent ?? 100) - (b.accuracyPercent ?? 100)
  );
  return rows.slice(0, Math.max(1, limit));
}

/**
 * @param {Record<string, { total: number, correct: number, wrong: number, accuracyPercent: number | null }>} topicStatsById
 */
export function topicStatsByIdFromMap(byTopic) {
  /** @type {Record<string, { total: number, correct: number, wrong: number, accuracyPercent: number | null }>} */
  const out = {};
  for (const [id, e] of byTopic) {
    out[id] = { total: e.total, correct: e.correct, wrong: e.wrong, accuracyPercent: e.accuracyPercent };
  }
  return out;
}

/**
 * @param {{
 *   attempts: QuizAttemptRow[],
 *   visits: VisitRow[],
 *   topicNamesById: Record<string, string>,
 *   wrongSamples?: Array<{ topic_id?: string, topic_name?: string, question_stem?: string | null }>,
 * }} input
 * @returns {{
 *   learningMemory: Record<string, unknown>,
 *   topicStatsById: Record<string, { total: number, correct: number, wrong: number, accuracyPercent: number | null }>,
 * }}
 */
export function buildLearningMemorySnapshot(input) {
  const nowMs = Date.now();
  const attempts = Array.isArray(input.attempts) ? input.attempts : [];
  const visits = Array.isArray(input.visits) ? input.visits : [];
  const topicNamesById = input.topicNamesById && typeof input.topicNamesById === "object" ? input.topicNamesById : {};

  const visitMs = visits
    .map((v) => Date.parse(v.visited_at))
    .filter((t) => Number.isFinite(t));
  const visitsLast14 = visitMs.filter((t) => nowMs - t <= 14 * DAY_MS);
  const studyDaysLast14 = distinctLocalDays(visitsLast14);
  const visitsLast7 = visitMs.filter((t) => nowMs - t <= 7 * DAY_MS);
  const studyDaysLast7 = distinctLocalDays(visitsLast7);

  const accLast7 = accuracyInDayWindow(attempts, { min: 0, max: 7 }, nowMs);
  const accPrev7 = accuracyInDayWindow(attempts, { min: 7, max: 14 }, nowMs);
  const trendLabel = classifyTrend(accLast7, accPrev7);

  const byTopic = aggregateAttemptsByTopic(attempts);
  const topicStatsById = topicStatsByIdFromMap(byTopic);
  const weakTopics = pickWeakTopicsForPrompt(byTopic, topicNamesById, 5);

  const topicIdSet = new Set(Object.keys(topicNamesById));
  const recentTopicOrder = deriveRecentTopicIdsFromVisits(visits, topicIdSet, 14);
  const recentStudyTopics = recentTopicOrder.slice(0, 12).map((topicId) => ({
    topicId,
    topicName: (topicNamesById[topicId] && String(topicNamesById[topicId]).trim()) || "Tópico",
  }));

  const total = attempts.length;
  const correctAll = attempts.filter((a) => a.is_correct).length;
  const globalAccuracyPercent = total > 0 ? Math.round((correctAll / total) * 100) : null;

  const wrongSamples = Array.isArray(input.wrongSamples) ? input.wrongSamples : [];
  const recentWrongHints = wrongSamples.slice(0, 3).map((w) => ({
    topicName:
      (typeof w.topic_name === "string" && w.topic_name.trim()) ||
      topicNamesById[w.topic_id ?? ""]?.trim() ||
      "Tópico",
    stemPreview: truncateStemPreview(w.question_stem ?? "", 140),
  }));

  const learningMemory = {
    studyDaysLast14,
    studyDaysLast7,
    quizAttemptsInScope: total,
    globalAccuracyPercent,
    accuracyLast7dPercent: accLast7,
    accuracyPrev7dPercent: accPrev7,
    trendLabel,
    weakTopics,
    recentStudyTopics,
    recentWrongHints,
  };

  return { learningMemory, topicStatsById };
}
