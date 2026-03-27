import { rankTopicErrorInsights } from "./studyErrorInsights.js";

export const MISSION_PRACTICE_TARGET = 3;

/**
 * Missão guiada a partir do tópico mais crítico nos insights de erro.
 * @param {Array<{ topic_id: string, topic_name?: string, subject_id?: string | null, contest_id?: string | null }>} insights
 * @returns {{
 *   id: string,
 *   topic_id: string,
 *   topic_name: string,
 *   subject_id: string,
 *   contest_id: string,
 *   steps: Array<{
 *     id: string,
 *     label: string,
 *     type: 'open_topic' | 'practice' | 'ask_ai',
 *     target?: number,
 *     progress?: number,
 *     done?: boolean,
 *   }>,
 * } | null}
 */
export function generateStudyMission(insights, topicStatsById = null) {
  if (!insights?.length) return null;

  const ranked = rankTopicErrorInsights(insights, topicStatsById);
  const top = ranked[0];
  if (!top?.topic_id) return null;

  const subjectId = top.subject_id ?? null;
  const contestId = top.contest_id ?? null;
  if (!subjectId || !contestId) return null;

  const name = top.topic_name?.trim() || "este tópico";

  return {
    id: `mission-${top.topic_id}`,
    topic_id: top.topic_id,
    topic_name: name,
    subject_id: subjectId,
    contest_id: contestId,
    steps: [
      {
        id: "review",
        label: `Revisar “${name}” (leitura guiada)`,
        type: "open_topic",
        done: false,
      },
      {
        id: "practice",
        label: `Acertar ${MISSION_PRACTICE_TARGET} questões neste tópico`,
        type: "practice",
        target: MISSION_PRACTICE_TARGET,
        progress: 0,
        done: false,
      },
      {
        id: "explain",
        label: "Pedir uma explicação extra à Yara",
        type: "ask_ai",
        done: false,
      },
    ],
  };
}

/**
 * @param {Record<string, unknown>} progress
 * @param {{ id: string, type?: string, target?: number }} step
 */
export function isMissionStepDone(progress, step) {
  if (!step?.id) return false;
  const p = progress ?? {};
  if (step.type === "practice") {
    const target = step.target ?? MISSION_PRACTICE_TARGET;
    const n = typeof p.practice === "number" ? p.practice : 0;
    return n >= target;
  }
  return Boolean(p[step.id]);
}

/**
 * @param {{ steps?: Array<{ id: string, type?: string, target?: number }> } | null} mission
 * @param {Record<string, unknown>} progress
 */
export function isMissionFullyDone(mission, progress) {
  if (!mission?.steps?.length) return false;
  return mission.steps.every((s) => isMissionStepDone(progress, s));
}
