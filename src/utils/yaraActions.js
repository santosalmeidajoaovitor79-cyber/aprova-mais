/** @typedef {{ type: string, params?: Record<string, unknown> } | null | undefined} YaraAction */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_TYPES = new Set([
  "open_explanation",
  "open_questions",
  "focus_chat",
  "open_review_errors",
  "open_dashboard",
  "open_topic",
]);

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v.trim());
}

/**
 * @param {unknown} raw
 * @returns {{ topicId: string, subjectId: string, contestId: string, topicName?: string }[]}
 */
export function sanitizeOpenTopicHints(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const topicId = row.topicId ?? row.topic_id;
    const subjectId = row.subjectId ?? row.subject_id;
    const contestId = row.contestId ?? row.contest_id;
    if (!isUuid(topicId) || !isUuid(subjectId) || !isUuid(contestId)) continue;
    const topicName = typeof row.topicName === "string" ? row.topicName.trim() : "";
    out.push({
      topicId: topicId.trim(),
      subjectId: subjectId.trim(),
      contestId: contestId.trim(),
      ...(topicName ? { topicName } : {}),
    });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * @param {{
 *   currentTopicId?: string | null,
 *   currentSubjectId?: string | null,
 *   currentContestId?: string | null,
 *   openTopicHints?: Array<{ topicId: string, subjectId: string, contestId: string }>,
 * }} ctx
 */
export function validateYaraAction(raw, ctx = {}) {
  if (!raw || typeof raw !== "object") return null;
  let type = String(raw.type ?? "").trim();
  if (type === "start_quiz") type = "open_questions";
  if (!ALLOWED_TYPES.has(type)) return null;
  const params =
    raw.params && typeof raw.params === "object" && !Array.isArray(raw.params)
      ? { ...raw.params }
      : {};

  if (type === "open_topic") {
    const topicId = String(params.topicId ?? "").trim();
    const subjectId = String(params.subjectId ?? "").trim();
    const contestId = String(params.contestId ?? "").trim();
    if (!isUuid(topicId) || !isUuid(subjectId) || !isUuid(contestId)) return null;

    const sameCurrent =
      ctx.currentTopicId === topicId &&
      ctx.currentSubjectId === subjectId &&
      ctx.currentContestId === contestId;

    const hints = ctx.openTopicHints ?? [];
    const inHints = hints.some(
      (h) => h.topicId === topicId && h.subjectId === subjectId && h.contestId === contestId
    );

    if (!sameCurrent && !inHints) return null;

    return {
      type,
      params: { topicId, subjectId, contestId },
    };
  }

  return { type, params: {} };
}
