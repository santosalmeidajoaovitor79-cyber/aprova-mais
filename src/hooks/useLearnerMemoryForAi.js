import { useEffect, useState } from "react";
import {
  fetchAllTopicsForContest,
  fetchRecentQuizAttemptsForUser,
  fetchVisitTimestampsForContest,
  fetchWrongAttemptsForReview,
} from "../api/studyActivityApi.js";
import { buildLearningMemorySnapshot } from "../utils/learnerMemoryProfile.js";

/**
 * Agrega histórico real (quiz + visitas no concurso) para contexto da Yara e recomendações.
 * Recalcula quando refreshNonce muda (ex.: após erro no quiz).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
export function useLearnerMemoryForAi(supabase, userId, contestId, refreshNonce = 0) {
  const [payload, setPayload] = useState(() => ({
    learningMemory: null,
    topicStatsById: null,
  }));

  useEffect(() => {
    if (!userId || !contestId) {
      setPayload({ learningMemory: null, topicStatsById: null });
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: topics, error: topicsErr } = await fetchAllTopicsForContest(supabase, contestId);
      if (cancelled) return;
      if (topicsErr || !topics?.length) {
        setPayload({ learningMemory: null, topicStatsById: null });
        return;
      }

      const topicIds = topics.map((t) => t.id).filter(Boolean);
      const topicSet = new Set(topicIds);
      const topicNamesById = Object.fromEntries(
        topics.map((t) => [t.id, typeof t.name === "string" ? t.name : ""])
      );

      const [attemptsRes, visitsRes, wrongRes] = await Promise.all([
        fetchRecentQuizAttemptsForUser(supabase, userId, 2500),
        fetchVisitTimestampsForContest(supabase, userId, contestId, 500),
        fetchWrongAttemptsForReview(supabase, userId, topicIds, 12),
      ]);

      if (cancelled) return;

      if (attemptsRes.error) {
        setPayload({ learningMemory: null, topicStatsById: null });
        return;
      }

      const rawAttempts = attemptsRes.data ?? [];
      const inScope = rawAttempts.filter((r) => r?.topic_id && topicSet.has(r.topic_id));

      const visits = visitsRes.data ?? [];
      const wrongRows = wrongRes.data ?? [];

      const wrongSamples = wrongRows.map((r) => ({
        topic_id: r.topic_id,
        topic_name: r.topics?.name,
        question_stem: r.question_stem,
      }));

      const snap = buildLearningMemorySnapshot({
        attempts: inScope,
        visits,
        topicNamesById,
        wrongSamples,
      });

      setPayload({
        learningMemory: snap.learningMemory,
        topicStatsById: snap.topicStatsById,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId, contestId, refreshNonce]);

  return payload;
}
