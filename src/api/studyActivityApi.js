/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ userId: string, topicId: string, contestId?: string | null, subjectId?: string | null }} row
 */
function isMissingColumnError(error, columnName) {
  const code = String(error?.code ?? "").trim();
  const message = String(error?.message ?? "").toLowerCase();
  return code === "42703" && message.includes(`column`) && message.includes(String(columnName).toLowerCase());
}

function logActivityFallback(label, error) {
  console.warn(`[studyActivityApi] ${label}`, {
    code: error?.code ?? "",
    message: error?.message ?? "",
  });
}

async function fetchTopicRowsByIds(supabase, topicIds) {
  const ids = [...new Set((topicIds ?? []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };
  return supabase.from("topics").select("id, subject_id").in("id", ids);
}

async function attachSubjectIdsFromTopics(supabase, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { data: [], error: null };
  const topicIds = [...new Set(list.map((row) => row?.topic_id).filter(Boolean))];
  const { data: topicRows, error } = await fetchTopicRowsByIds(supabase, topicIds);
  if (error) return { data: list, error };
  const subjectByTopicId = Object.fromEntries((topicRows ?? []).map((row) => [row.id, row.subject_id ?? null]));
  return {
    data: list.map((row) => ({
      ...row,
      subject_id: row?.subject_id ?? subjectByTopicId[row?.topic_id] ?? null,
    })),
    error: null,
  };
}

async function fetchTopicIdsForContest(supabase, contestId) {
  if (!contestId) return { data: [], error: null };
  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .select("id")
    .eq("contest_id", contestId);
  if (subjectError) return { data: [], error: subjectError };
  const subjectIds = (subjects ?? []).map((row) => row.id).filter(Boolean);
  if (!subjectIds.length) return { data: [], error: null };
  const { data: topics, error: topicError } = await supabase
    .from("topics")
    .select("id")
    .in("subject_id", subjectIds);
  if (topicError) return { data: [], error: topicError };
  return { data: (topics ?? []).map((row) => row.id).filter(Boolean), error: null };
}

export async function upsertTopicVisit(supabase, { userId, topicId, contestId, subjectId }) {
  const baseRow = {
    user_id: userId,
    topic_id: topicId,
    subject_id: subjectId ?? null,
    visited_at: new Date().toISOString(),
  };

  let response = await supabase
    .from("user_topic_visits")
    .upsert(
      {
        ...baseRow,
        contest_id: contestId ?? null,
      },
      { onConflict: "user_id,topic_id" }
    );

  if (!response.error) return response;
  if (!isMissingColumnError(response.error, "contest_id")) return response;

  logActivityFallback("contest_id ausente em user_topic_visits; gravando sem este campo.", response.error);
  response = await supabase.from("user_topic_visits").upsert(baseRow, { onConflict: "user_id,topic_id" });

  if (!response.error || !isMissingColumnError(response.error, "subject_id")) return response;

  logActivityFallback("subject_id ausente em user_topic_visits; gravando só topic_id.", response.error);
  return supabase
    .from("user_topic_visits")
    .upsert(
      {
        user_id: userId,
        topic_id: topicId,
        visited_at: baseRow.visited_at,
      },
      { onConflict: "user_id,topic_id" }
    );
}

export async function fetchRecentVisits(supabase, userId, limit = 8) {
  let response = await supabase
    .from("user_topic_visits")
    .select("topic_id, visited_at, subject_id")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(limit);

  if (!response.error) return response;
  if (!isMissingColumnError(response.error, "subject_id")) return response;

  logActivityFallback("subject_id ausente em user_topic_visits; enriquecendo via topics.", response.error);
  response = await supabase
    .from("user_topic_visits")
    .select("topic_id, visited_at")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (response.error) return response;

  const enriched = await attachSubjectIdsFromTopics(supabase, response.data ?? []);
  return { data: enriched.data ?? [], error: enriched.error };
}

export async function fetchTopicNames(supabase, topicIds) {
  if (!topicIds.length) return { data: [], error: null };
  return supabase.from("topics").select("id, name").in("id", topicIds);
}

export async function countUserQuestionMessages(supabase, userId) {
  return supabase
    .from("topic_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user");
}

/** Conta tópicos do concurso (via matérias). */
export async function countTopicsInContest(supabase, contestId) {
  if (!contestId) return { count: 0, error: null };
  const { data: subjects, error: sErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("contest_id", contestId);
  if (sErr) return { count: 0, error: sErr };
  const ids = (subjects ?? []).map((s) => s.id);
  if (!ids.length) return { count: 0, error: null };
  const { count, error } = await supabase
    .from("topics")
    .select("id", { count: "exact", head: true })
    .in("subject_id", ids);
  return { count: count ?? 0, error };
}

/** Tópicos distintos visitados neste concurso. */
export async function fetchVisitedTopicIdsForContest(supabase, userId, contestId) {
  if (!contestId) return { data: [], error: null };
  const { data: topicIds, error: topicErr } = await fetchTopicIdsForContest(supabase, contestId);
  if (topicErr) return { data: [], error: topicErr };
  if (!topicIds.length) return { data: [], error: null };
  return supabase
    .from("user_topic_visits")
    .select("topic_id")
    .eq("user_id", userId)
    .in("topic_id", topicIds);
}

export async function fetchVisitTimestamps(supabase, userId, limit = 400) {
  return supabase
    .from("user_topic_visits")
    .select("visited_at")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(limit);
}

/** Visitas só do concurso principal (frequência / hábito + tópicos recentes para simulado adaptativo). */
export async function fetchVisitTimestampsForContest(supabase, userId, contestId, limit = 500) {
  if (!contestId) return { data: [], error: null };
  const { data: topicIds, error: topicErr } = await fetchTopicIdsForContest(supabase, contestId);
  if (topicErr) return { data: [], error: topicErr };
  if (!topicIds.length) return { data: [], error: null };
  return supabase
    .from("user_topic_visits")
    .select("topic_id, visited_at")
    .eq("user_id", userId)
    .in("topic_id", topicIds)
    .order("visited_at", { ascending: false })
    .limit(limit);
}

/**
 * Últimas tentativas de quiz do usuário (todas as matérias), para filtrar no cliente ao escopo do concurso.
 * Evita URI gigante com .in(topic_id, …) em concursos grandes.
 * @param {number} [limit=2500]
 */
export async function fetchRecentQuizAttemptsForUser(supabase, userId, limit = 2500) {
  if (!userId) return { data: [], error: null };
  const cap = Math.min(Math.max(limit, 1), 4000);
  return supabase
    .from("topic_question_attempts")
    .select("topic_id, is_correct, attempted_at")
    .eq("user_id", userId)
    .order("attempted_at", { ascending: false })
    .limit(cap);
}

/** Lista tópicos (id, name, subject_id) de um concurso para sugestão. */
export async function fetchAllTopicsForContest(supabase, contestId) {
  if (!contestId) return { data: [], error: null };
  const { data: subjects, error: sErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("contest_id", contestId);
  if (sErr) return { data: [], error: sErr };
  const ids = (subjects ?? []).map((s) => s.id);
  if (!ids.length) return { data: [], error: null };
  return supabase
    .from("topics")
    .select("id, name, subject_id")
    .in("subject_id", ids)
    .order("name");
}

export async function fetchSubjectNamesByIds(supabase, subjectIds) {
  if (!subjectIds.length) return { data: [], error: null };
  return supabase.from("subjects").select("id, name").in("id", subjectIds);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{
 *   userId: string,
 *   topicId: string,
 *   questionKey: string,
 *   selectedIndex: number,
 *   correctIndex: number,
 *   isCorrect: boolean,
 *   questionStem?: string | null,
 *   selectedLabel?: string | null,
 *   correctLabel?: string | null,
 * }} row
 */
export async function insertQuestionAttempt(supabase, row) {
  const payload = {
    user_id: row.userId,
    topic_id: row.topicId,
    question_key: row.questionKey,
    selected_index: row.selectedIndex,
    correct_index: row.correctIndex,
    is_correct: row.isCorrect,
  };
  if (row.questionStem != null && row.questionStem !== "") payload.question_stem = row.questionStem;
  if (row.selectedLabel != null && row.selectedLabel !== "") payload.selected_label = row.selectedLabel;
  if (row.correctLabel != null && row.correctLabel !== "") payload.correct_label = row.correctLabel;
  return supabase.from("topic_question_attempts").insert(payload);
}

const ATTEMPT_SELECT =
  "id, attempted_at, question_key, selected_index, correct_index, question_stem, selected_label, correct_label, topic_id";

/** Evita URI gigante em .in(topic_id, …) em concursos com muitos tópicos. */
const TOPIC_ID_IN_CHUNK = 100;

async function selectInChunks(supabase, userId, topicIds, cap) {
  const ids = [...new Set((topicIds ?? []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };

  const chunks = [];
  for (let i = 0; i < ids.length; i += TOPIC_ID_IN_CHUNK) {
    chunks.push(ids.slice(i, i + TOPIC_ID_IN_CHUNK));
  }

  const rows = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("topic_question_attempts")
      .select(ATTEMPT_SELECT)
      .eq("user_id", userId)
      .eq("is_correct", false)
      .in("topic_id", chunk)
      .order("attempted_at", { ascending: false })
      .limit(cap);

    if (error) {
      return { data: [], error };
    }
    rows.push(...(data ?? []));
  }

  rows.sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime());
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    deduped.push(r);
    if (deduped.length >= cap) break;
  }
  return { data: deduped, error: null };
}

/**
 * Fallback: erros recentes do usuário no escopo global, filtrados ao concurso em memória.
 * Usa quando a lista de topicIds está vazia ou a query por chunks falha por limite/URL.
 */
async function fetchWrongAttemptsFallback(supabase, userId, topicSet, cap) {
  const fetchLimit = Math.min(400, Math.max(cap * 4, cap));
  const { data, error } = await supabase
    .from("topic_question_attempts")
    .select(ATTEMPT_SELECT)
    .eq("user_id", userId)
    .eq("is_correct", false)
    .order("attempted_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    return { data: [], error };
  }
  let rows = data ?? [];
  if (topicSet && topicSet.size) {
    rows = rows.filter((r) => topicSet.has(r.topic_id));
  }
  return { data: rows.slice(0, cap), error: null };
}

async function enrichAttemptsWithCatalog(supabase, attemptRows) {
  if (!attemptRows.length) return [];

  const topicIdsFound = [...new Set(attemptRows.map((r) => r.topic_id).filter(Boolean))];
  const topicMap = new Map();

  for (let i = 0; i < topicIdsFound.length; i += TOPIC_ID_IN_CHUNK) {
    const chunk = topicIdsFound.slice(i, i + TOPIC_ID_IN_CHUNK);
    const { data: topics, error: tErr } = await supabase
      .from("topics")
      .select("id, name, subject_id")
      .in("id", chunk);

    if (tErr) {
      continue;
    }
    for (const t of topics ?? []) {
      topicMap.set(t.id, t);
    }
  }

  const subjectIds = [...new Set([...topicMap.values()].map((t) => t.subject_id).filter(Boolean))];
  const subjectMap = new Map();
  for (let i = 0; i < subjectIds.length; i += TOPIC_ID_IN_CHUNK) {
    const chunk = subjectIds.slice(i, i + TOPIC_ID_IN_CHUNK);
    const { data: subjects, error: sErr } = await supabase
      .from("subjects")
      .select("id, name, contest_id")
      .in("id", chunk);

    if (sErr) {
      continue;
    }
    for (const s of subjects ?? []) {
      subjectMap.set(s.id, s);
    }
  }

  return attemptRows.map((row) => {
    const t = topicMap.get(row.topic_id) ?? null;
    const s = t?.subject_id ? subjectMap.get(t.subject_id) ?? null : null;
    return {
      ...row,
      topics: t
        ? {
            id: t.id,
            name: t.name,
            subject_id: t.subject_id,
            subjects: s ? { id: s.id, name: s.name, contest_id: s.contest_id } : null,
          }
        : null,
    };
  });
}

/**
 * Erros de quiz do usuário (is_correct = false), com tópico e matéria, mais recentes primeiro.
 * Leitura em duas fases (tentativas → catálogo) para evitar falhas de embed aninhado no PostgREST.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} userId
 * @param {string[]} topicIds — tópicos do concurso em foco (vazio = fallback por tempo)
 * @param {number} [limit=80]
 */
export async function fetchWrongAttemptsForReview(supabase, userId, topicIds, limit = 80) {
  if (!userId) return { data: [], error: null };
  const cap = Math.min(Math.max(limit, 1), 200);
  const topicSet = topicIds?.length ? new Set(topicIds.filter(Boolean)) : null;

  let attempts;
  let err;

  if (topicSet?.size) {
    const chunked = await selectInChunks(supabase, userId, topicIds, cap);
    attempts = chunked.data;
    err = chunked.error;
  } else {
    const fb = await fetchWrongAttemptsFallback(supabase, userId, null, cap);
    attempts = fb.data;
    err = fb.error;
  }

  if (err) {
    if (topicSet?.size) {
      const fb = await fetchWrongAttemptsFallback(supabase, userId, topicSet, cap);
      attempts = fb.data;
      err = fb.error;
    }
    if (err) {
      console.error("Erro ao buscar tentativas incorretas para revisão:", err);
      return { data: [], error: err };
    }
  }

  if (topicSet?.size && attempts.length === 0) {
    const fb = await fetchWrongAttemptsFallback(supabase, userId, topicSet, cap);
    if (!fb.error && fb.data.length) {
      attempts = fb.data;
    }
  }

  const enriched = await enrichAttemptsWithCatalog(supabase, attempts);
  return { data: enriched, error: null };
}

export async function fetchAttemptsForTopics(supabase, userId, topicIds) {
  if (!topicIds.length) return { data: [], error: null };
  return supabase
    .from("topic_question_attempts")
    .select("topic_id, is_correct")
    .eq("user_id", userId)
    .in("topic_id", topicIds);
}

export async function fetchAttemptsForTopic(supabase, userId, topicId) {
  if (!topicId) return { data: [], error: null };
  return supabase
    .from("topic_question_attempts")
    .select("is_correct")
    .eq("user_id", userId)
    .eq("topic_id", topicId);
}

/** Para streak e dias distintos — aumente limit se o histórico for muito longo. */
export async function fetchVisitRowsForStreak(supabase, userId, limit = 3000) {
  return supabase
    .from("user_topic_visits")
    .select("visited_at")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(limit);
}

/** Tentativas de quiz desde uma data (ISO), para evolução diária da taxa de acerto. */
export async function fetchAttemptsSince(supabase, userId, sinceIso) {
  return supabase
    .from("topic_question_attempts")
    .select("attempted_at, is_correct")
    .eq("user_id", userId)
    .gte("attempted_at", sinceIso)
    .order("attempted_at", { ascending: true });
}

export async function countVisitsSince(supabase, userId, sinceIso) {
  return supabase
    .from("user_topic_visits")
    .select("topic_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("visited_at", sinceIso);
}

export async function countAttemptsSince(supabase, userId, sinceIso) {
  return supabase
    .from("topic_question_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("attempted_at", sinceIso);
}
