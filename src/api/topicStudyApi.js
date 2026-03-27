export async function fetchTopicMessages(supabase, topicId, limit = 40) {
  return supabase
    .from("topic_messages")
    .select("role, content")
    .eq("topic_id", topicId)
    .order("created_at", { ascending: true })
    .limit(limit);
}

/** Apaga todas as mensagens do usuário atual neste tópico (RLS: só linhas com user_id = auth.uid()). */
export async function deleteTopicMessagesForTopic(supabase, topicId) {
  return supabase.from("topic_messages").delete().eq("topic_id", topicId);
}

export async function fetchTopicExplanationContent(supabase, topicId) {
  return supabase
    .from("topic_explanations")
    .select("content")
    .eq("topic_id", topicId)
    .maybeSingle();
}

/**
 * Repassa explicitamente o access_token da sessão no Authorization (Bearer),
 * para as Edge Functions receberem o mesmo JWT que o cliente usa nas queries.
 */
async function invokeWithSessionJwt(supabase, functionName, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return supabase.functions.invoke(functionName, { body, headers });
}

function mergeExam(body, examPayload) {
  if (!examPayload || typeof examPayload !== "object") return body;
  return { ...body, ...examPayload };
}

export async function invokeGenerateTopicExplanation(supabase, topicId, examPayload) {
  return invokeWithSessionJwt(
    supabase,
    "generate-topic-explanation",
    mergeExam({ topicId }, examPayload)
  );
}

export async function invokeStudyChat(supabase, topicId, message, examPayload) {
  return invokeWithSessionJwt(supabase, "study-chat", mergeExam({ topicId, message }, examPayload));
}

/**
 * @param {Record<string, unknown>} [recoveryExtra] recoveryMode, recoveryQuestionCount, recoveryContext
 */
export async function invokeGenerateTopicQuestions(supabase, topicId, examPayload, recoveryExtra) {
  const body =
    recoveryExtra && typeof recoveryExtra === "object"
      ? { topicId, ...recoveryExtra }
      : { topicId };
  return invokeWithSessionJwt(supabase, "generate-topic-questions", mergeExam(body, examPayload));
}

/**
 * Explicação contextual após erro no quiz (Yara): resumo do erro, por que a correta vale, confusão provável.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>} quizPayload topicId, questionStem, options, selectedIndex, correctIndex, selectedLabel, correctLabel, topicName?, simplify?
 * @param {Record<string, unknown>} [examPayload]
 */
export async function invokeExplainQuizMistake(supabase, quizPayload, examPayload) {
  return invokeWithSessionJwt(
    supabase,
    "explain-quiz-mistake",
    mergeExam(quizPayload && typeof quizPayload === "object" ? quizPayload : {}, examPayload)
  );
}
