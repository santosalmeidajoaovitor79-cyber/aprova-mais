const key = (userId) => `aprova_last_study_session_${userId}`;

/**
 * @param {string} userId
 * @returns {{
 *   contestId?: string,
 *   subjectId?: string,
 *   topicId?: string,
 *   topicName?: string,
 *   contestName?: string,
 *   subjectName?: string,
 *   activeStudyTab?: string,
 *   quizTotal?: number,
 *   quizRevealed?: number,
 *   explanationReady?: boolean,
 *   mainTab?: string,
 *   studyFocusMode?: boolean,
 *   lastStudyUiChat?: boolean,
 * } | null}
 */
export function readLastStudySession(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    return o;
  } catch {
    return null;
  }
}

/**
 * @param {string} userId
 * @param {{ contestId?: string | null, subjectId?: string | null, topicId?: string | null, topicName?: string | null, contestName?: string | null, subjectName?: string | null }} snap
 */
export function writeLastStudySession(userId, snap) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(snap));
  } catch {
    /* ignore quota */
  }
}

export function clearLastStudySession(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
