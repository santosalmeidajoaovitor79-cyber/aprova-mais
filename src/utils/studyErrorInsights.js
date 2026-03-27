/**
 * @typedef {{ topic_id: string, topic_name?: string, attempted_at: string | number | Date, subject_id?: string | null, contest_id?: string | null }} WrongAttemptInsightInput
 */

/**
 * @typedef {{ topic_id: string, topic_name: string, errors: number, recentErrors: number, subject_id?: string | null, contest_id?: string | null }} TopicErrorInsight
 */

const RECENT_MS = 1000 * 60 * 60 * 24 * 3;

function pickTopicId(item) {
  return item.topic_id ?? item.topicId ?? "";
}

function pickTopicName(item) {
  const n = item.topic_name ?? item.topicName;
  return typeof n === "string" && n.trim() ? n.trim() : "Sem nome";
}

function pickAttemptedAt(item) {
  const v = item.attempted_at ?? item.attemptedAt;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function pickSubjectId(item) {
  return item.subject_id ?? item.subjectId ?? null;
}

function pickContestId(item) {
  return item.contest_id ?? item.contestId ?? null;
}

/**
 * Agrupa tentativas erradas por tópico e prioriza recência (últimos 3 dias).
 * @param {WrongAttemptInsightInput[]} reviewList
 * @returns {TopicErrorInsight[]}
 */
export function getErrorInsights(reviewList) {
  const byTopic = new Map();

  for (const item of reviewList ?? []) {
    const key = pickTopicId(item);
    if (!key) continue;

    if (!byTopic.has(key)) {
      byTopic.set(key, {
        topic_id: key,
        topic_name: pickTopicName(item),
        errors: 0,
        recentErrors: 0,
        subject_id: pickSubjectId(item),
        contest_id: pickContestId(item),
      });
    }

    const entry = byTopic.get(key);
    entry.errors += 1;

    const ts = pickAttemptedAt(item);
    const isRecent = ts > Date.now() - RECENT_MS;
    if (isRecent) {
      entry.recentErrors += 1;
    }
    if (!entry.subject_id && pickSubjectId(item)) entry.subject_id = pickSubjectId(item);
    if (!entry.contest_id && pickContestId(item)) entry.contest_id = pickContestId(item);
  }

  return Array.from(byTopic.values()).sort((a, b) => {
    return b.recentErrors - a.recentErrors || b.errors - a.errors;
  });
}

/**
 * Prioriza tópicos críticos combinando erros recentes, volume histórico e taxa de acerto no quiz.
 * @param {TopicErrorInsight[]} insights
 * @param {Record<string, { total?: number, wrong?: number, accuracyPercent?: number | null }> | null | undefined} topicStatsById
 * @returns {TopicErrorInsight[]}
 */
export function rankTopicErrorInsights(insights, topicStatsById) {
  if (!insights?.length) return [];
  if (!topicStatsById || typeof topicStatsById !== "object") return [...insights];

  /**
   * @param {TopicErrorInsight} insight
   */
  function score(insight) {
    const s = topicStatsById[insight.topic_id];
    const total = typeof s?.total === "number" ? s.total : 0;
    const acc = s?.accuracyPercent != null ? Number(s.accuracyPercent) : 100;
    let x = (insight.recentErrors ?? 0) * 3 + (insight.errors ?? 0) * 0.45;
    if (total >= 6 && acc < 48) x += 10;
    else if (total >= 4 && acc < 55) x += 6;
    if (total >= 12 && acc < 68) x += 3;
    return x;
  }

  return [...insights].sort((a, b) => score(b) - score(a));
}

/**
 * @param {TopicErrorInsight[]} insights
 * @param {Record<string, { total?: number, wrong?: number, accuracyPercent?: number | null }> | null | undefined} [topicStatsById]
 * @returns {{
 *   type: 'focus' | 'reinforce' | 'continue',
 *   message: string,
 *   topic_id?: string,
 *   topic_name?: string,
 *   subject_id?: string | null,
 *   contest_id?: string | null
 * } | null}
 */
export function generateStudyRecommendation(insights, topicStatsById = null) {
  if (!insights?.length) return null;

  const ranked = rankTopicErrorInsights(insights, topicStatsById);
  const top = ranked[0];

  if (top.recentErrors >= 3) {
    return {
      type: "focus",
      message: `Você errou várias vezes em “${top.topic_name}”. Vale revisar com calma agora.`,
      topic_id: top.topic_id,
      topic_name: top.topic_name,
      subject_id: top.subject_id ?? null,
      contest_id: top.contest_id ?? null,
    };
  }

  if (top.errors >= 5) {
    return {
      type: "reinforce",
      message: `Esse tópico ainda pede reforço: “${top.topic_name}”.`,
      topic_id: top.topic_id,
      topic_name: top.topic_name,
      subject_id: top.subject_id ?? null,
      contest_id: top.contest_id ?? null,
    };
  }

  return {
    type: "continue",
    message: "Seu padrão de erros está equilibrado — continue o plano e use revisão quando quiser reforçar.",
  };
}
