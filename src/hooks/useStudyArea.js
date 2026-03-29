import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as catalogApi from "../api/studyCatalogApi.js";
import * as profilesApi from "../api/profilesApi.js";
import * as activityApi from "../api/studyActivityApi.js";
import * as topicApi from "../api/topicStudyApi.js";
import { buildFullAiPayload } from "../utils/examDate.js";
import {
  createDefaultLearningFeedback,
  inferExplicitLearningFeedback,
  inferImplicitLearningFeedbackFromMessage,
  inferImplicitLearningFeedbackFromQuiz,
  mergeLearningFeedback,
} from "../utils/learningFeedbackLoop.js";
import { readTopicCache, writeTopicCache } from "../utils/studyTopicCacheStorage.js";
import {
  createDefaultStudySessionState,
  detectUserIntent,
  updateStudySessionState,
} from "../utils/studySessionFlow.js";
import {
  clearLastStudySession,
  readLastStudySession,
  writeLastStudySession,
} from "../utils/studySessionStorage.js";
import {
  buildStoredStudyResumeMeta,
  buildStudyResumeJourney,
} from "../utils/studyResumeJourney.js";
import { pickRecoveryTrainingFeedback } from "../utils/recoveryTrainingFeedback.js";
import { buildYaraMiniSessionSnapshot } from "../utils/yaraMiniSessionUi.js";
import {
  buildAdaptiveSimuladoAllocations,
  buildFallbackSimuladoAllocations,
  expandAllocationChunks,
  shuffleArray,
} from "../utils/adaptiveSimuladoPlan.js";
import { buildSimuladoYaraUserPrompt } from "../utils/adaptiveSimuladoDebrief.js";
import { writeLastSimuladoSession } from "../utils/simuladoHintStorage.js";

/**
 * Passos de mini-sessão ainda não executados (retorno do study-chat; no máx. 2).
 * @param {unknown} raw
 * @returns {{ type: string, params: Record<string, unknown> }[]}
 */
function normalizePendingSessionActionsFromResponse(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const type = typeof item.type === "string" ? item.type.trim() : "";
    if (!type) continue;
    const params =
      item.params && typeof item.params === "object" && !Array.isArray(item.params) ? item.params : {};
    out.push({ type, params });
    if (out.length >= 2) break;
  }
  return out;
}

/**
 * @typedef {{ mainExamId?: string | null, lastContestId?: string | null, lastSubjectId?: string | null, lastTopicId?: string | null }} StudyProfileMeta
 */

/**
 * Catálogo + explicação + questões + chat, com cache por topicId e persistência de sessão.
 * @param {{
 *   onWrongAttemptRecorded?: () => void,
 *   onQuestionRevealed?: (payload: { topicId: string, isCorrect: boolean }) => void,
 *   persistExtrasRef?: React.MutableRefObject<Record<string, unknown> | null | undefined>,
 *   onAssistantAction?: (action: { type: string, params?: Record<string, unknown> } | null) => void,
 *   onRequestWorkspaceSubTab?: (tab: "explanation" | "questions" | "chat") => void,
 *   onAdaptiveSimuladoComplete?: () => void,
 *   featureAccess?: Record<string, unknown>,
 *   consumeChatQuota?: (amount?: number) => Promise<{ allowed?: boolean, error?: string }>,
 *   consumeQuestionQuota?: (amount?: number) => Promise<{ allowed?: boolean, error?: string }>,
 *   consumeRecoverySession?: (amount?: number) => Promise<{ allowed?: boolean, error?: string }>,
 * }} [studyAreaOptions]
 */
export function useStudyArea(
  supabase,
  session,
  examDate,
  studyMeta,
  studyMetaReady,
  learnerMetrics,
  studyAreaOptions = {}
) {
  const {
    onWrongAttemptRecorded,
    onQuestionRevealed,
    persistExtrasRef,
    onAssistantAction,
    onRequestWorkspaceSubTab,
    onAdaptiveSimuladoComplete,
    featureAccess,
    consumeChatQuota,
    consumeQuestionQuota,
    consumeRecoverySession,
  } = studyAreaOptions;
  const userId = session?.user?.id ?? null;

  const [selectedContest, setSelectedContest] = useState(null);
  const selectedContestRef = useRef(null);
  selectedContestRef.current = selectedContest;
  const [selectedSubject, setSelectedSubject] = useState(null);
  const selectedSubjectRef = useRef(null);
  selectedSubjectRef.current = selectedSubject;
  const [selectedTopic, setSelectedTopic] = useState(null);
  const selectedTopicRef = useRef(null);
  selectedTopicRef.current = selectedTopic;

  /** Próximos passos da mini-sessão da Yara (só contexto no próximo request; só o 1º dispara ação). */
  const studySessionPendingStepsRef = useRef([]);

  const [catalogError, setCatalogError] = useState("");
  const [topicFlowError, setTopicFlowError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatHistoryClearing, setChatHistoryClearing] = useState(false);

  const [contests, setContests] = useState([]);
  const contestsRef = useRef(contests);
  contestsRef.current = contests;
  const [subjectsList, setSubjectsList] = useState([]);
  const [topicsList, setTopicsList] = useState([]);
  const [topicExplanation, setTopicExplanation] = useState("");
  const [topicChatMessages, setTopicChatMessages] = useState([]);
  const [yaraMiniSessionUi, setYaraMiniSessionUi] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [studySessionState, setStudySessionState] = useState(() => createDefaultStudySessionState());
  const [learningFeedback, setLearningFeedback] = useState(() => createDefaultLearningFeedback());
  const [topicQuestions, setTopicQuestions] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [questionPicks, setQuestionPicks] = useState({});
  const [questionRevealed, setQuestionRevealed] = useState({});
  const [quizMistakeByKey, setQuizMistakeByKey] = useState({});
  const [recoveryTrainingMeta, setRecoveryTrainingMeta] = useState(null);
  const [recoveryFeedback, setRecoveryFeedback] = useState(null);
  const [studySubTab, setStudySubTab] = useState("explanation");

  const contestTreeContext = useMemo(
    () => ({
      source: selectedContest?.source_catalog_id ? "contest_catalog" : "runtime_fallback",
      contestCatalogId: selectedContest?.source_catalog_id ?? null,
      subjects: subjectsList.slice(0, 12).map((subject) => ({
        id: subject.id,
        name: subject.name,
        weight: subject.weight ?? null,
        displayOrder: subject.display_order ?? null,
      })),
      currentSubjectTopics: topicsList.slice(0, 20).map((topic) => ({
        id: topic.id,
        name: topic.name,
        weight: topic.weight ?? null,
        displayOrder: topic.display_order ?? null,
      })),
    }),
    [selectedContest?.source_catalog_id, subjectsList, topicsList]
  );

  const aiPayload = useMemo(
    () =>
      buildFullAiPayload(examDate, selectedContest, selectedSubject, selectedTopic, learnerMetrics, {
        flowMoment: studySubTab === "questions" ? "pre_questions" : "chat",
        studySessionContext: studySessionState,
        learningFeedback,
        contestTree: contestTreeContext,
      }),
    [
      examDate,
      selectedContest,
      selectedSubject,
      selectedTopic,
      learnerMetrics,
      studySubTab,
      studySessionState,
      learningFeedback,
      contestTreeContext,
    ]
  );
  const predictedRisk = aiPayload?.predictedRisk ?? null;
  const nextBestAction = aiPayload?.nextBestAction ?? null;

  /** Mini simulado adaptativo (vários tópicos; questões com sourceTopicId). */
  const [adaptiveSimuladoMeta, setAdaptiveSimuladoMeta] = useState(null);
  const [adaptiveSimuladoResult, setAdaptiveSimuladoResult] = useState(null);
  const simuladoFinalizeRef = useRef(null);

  const lastRestoreFingerprintRef = useRef("");
  const persistTimerRef = useRef(null);
  const lastRecoveryFeedbackSessionRef = useRef(null);
  const studySessionStateRef = useRef(createDefaultStudySessionState());
  const learningFeedbackRef = useRef(createDefaultLearningFeedback());
  const lastAssistantActionTypeRef = useRef("");

  useEffect(() => {
    lastRestoreFingerprintRef.current = "";
  }, [userId]);

  useEffect(() => {
    studySessionPendingStepsRef.current = [];
    setYaraMiniSessionUi(null);
    const freshState = createDefaultStudySessionState();
    studySessionStateRef.current = freshState;
    setStudySessionState(freshState);
    const freshFeedback = createDefaultLearningFeedback();
    learningFeedbackRef.current = freshFeedback;
    setLearningFeedback(freshFeedback);
    lastAssistantActionTypeRef.current = "";
  }, [selectedTopic?.id]);

  const updateLearningFeedbackState = useCallback((...patches) => {
    const next = mergeLearningFeedback(learningFeedbackRef.current, ...patches);
    learningFeedbackRef.current = next;
    setLearningFeedback(next);
    return next;
  }, []);

  const buildCurrentStudySessionContext = useCallback(() => {
    const questions = Array.isArray(topicQuestions) ? topicQuestions : [];
    let quizAnswered = 0;
    let recentErrors = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const key = q.id ?? `q-${i}`;
      if (!questionRevealed[key]) continue;
      const pick = questionPicks[key];
      if (pick === undefined) continue;
      quizAnswered += 1;
      if (pick !== q.correctIndex) recentErrors += 1;
    }

    return {
      recentErrors,
      quizAnswered,
      currentSubTab: studySubTab,
      lastAssistantActionType: lastAssistantActionTypeRef.current || null,
    };
  }, [topicQuestions, questionRevealed, questionPicks, studySubTab]);

  const resolveFlowMoment = useCallback(
    (overrideStudySessionContext = null) => {
      if (studySubTab === "questions") return "pre_questions";
      const sessionCtx =
        overrideStudySessionContext && typeof overrideStudySessionContext === "object"
          ? overrideStudySessionContext
          : null;
      const userTurns = topicChatMessages.filter((msg) => msg?.role === "user").length;
      if (userTurns === 0 && (sessionCtx?.phase === "learning" || explanationLoading)) {
        return "post_explanation";
      }
      return "chat";
    },
    [studySubTab, topicChatMessages, explanationLoading]
  );

  const persistCurrentTopic = useCallback(() => {
    if (adaptiveSimuladoMeta) return;
    const tid = selectedTopic?.id;
    if (!userId || !tid) return;
    if (explanationLoading) return;
    if (topicExplanation === "Carregando explicação...") return;

    const all = readTopicCache(userId);
    all[tid] = {
      explanation: topicExplanation,
      questions: topicQuestions,
      questionsError,
      picks: questionPicks,
      revealed: questionRevealed,
    };
    writeTopicCache(userId, all);
  }, [
    userId,
    selectedTopic?.id,
    topicExplanation,
    topicQuestions,
    questionsError,
    questionPicks,
    questionRevealed,
    explanationLoading,
    adaptiveSimuladoMeta,
  ]);

  useEffect(() => {
    persistCurrentTopic();
  }, [persistCurrentTopic]);

  const resetAll = useCallback(() => {
    lastRestoreFingerprintRef.current = "";
    setSelectedContest(null);
    setSelectedSubject(null);
    setSelectedTopic(null);
    setTopicsList([]);
    setSubjectsList([]);
    setContests([]);
    setTopicExplanation("");
    setTopicChatMessages([]);
    setChatInput("");
    setTopicFlowError("");
    setCatalogError("");
    setTopicQuestions(null);
    setQuestionsError("");
    setQuestionsLoading(false);
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});
    setRecoveryTrainingMeta(null);
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;
    setStudySubTab("explanation");
    setAdaptiveSimuladoMeta(null);
    setAdaptiveSimuladoResult(null);
    simuladoFinalizeRef.current = null;
    const freshFeedback = createDefaultLearningFeedback();
    learningFeedbackRef.current = freshFeedback;
    setLearningFeedback(freshFeedback);
    if (userId) {
      writeTopicCache(userId, {});
      clearLastStudySession(userId);
    }
  }, [userId]);

  const onStudySubTabChange = useCallback((tab) => {
    if (typeof tab === "string") setStudySubTab(tab);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setContests([]);
      setSubjectsList([]);
      setTopicsList([]);
      setSelectedContest(null);
      setSelectedSubject(null);
      setSelectedTopic(null);
      lastRestoreFingerprintRef.current = "";
      return;
    }

    let cancelled = false;

    async function loadContests() {
      setCatalogLoading(true);
      setCatalogError("");
      const { data, error: contestsError } = await catalogApi.fetchContests(supabase);

      if (cancelled) return;

      if (contestsError) {
        setCatalogError(contestsError.message);
        setContests([]);
      } else {
        setContests(data ?? []);
      }

      setCatalogLoading(false);
    }

    loadContests();

    return () => {
      cancelled = true;
    };
  }, [session?.user, supabase]);

  useEffect(() => {
    if (!session?.user || !selectedContest?.id) {
      setSubjectsList([]);
      return;
    }

    let cancelled = false;

    async function loadSubjects() {
      setCatalogError("");
      const { data, error: subjectsError } = await catalogApi.fetchSubjectsByContest(
        supabase,
        selectedContest.id
      );

      if (cancelled) return;

      if (subjectsError) {
        setCatalogError(subjectsError.message);
        setSubjectsList([]);
      } else {
        setSubjectsList(data ?? []);
      }
    }

    loadSubjects();

    return () => {
      cancelled = true;
    };
  }, [session?.user, selectedContest?.id, supabase]);

  const loadTopicExperience = useCallback(
    async (topic, contest, subject, payload) => {
      if (!topic?.id || !session?.user) return;

      setChatInput("");
      setTopicFlowError("");
      setQuestionsError("");
      setQuizMistakeByKey({});
      setRecoveryTrainingMeta(null);
      setRecoveryFeedback(null);
      lastRecoveryFeedbackSessionRef.current = null;

      let hadCache = false;
      if (userId) {
        const entry = readTopicCache(userId)[topic.id];
        const ex = entry?.explanation;
        if (ex && ex !== "Carregando explicação...") {
          setTopicExplanation(ex);
          setTopicQuestions(entry.questions ?? null);
          setQuestionsError(entry.questionsError ?? "");
          setQuestionPicks(entry.picks && typeof entry.picks === "object" ? entry.picks : {});
          setQuestionRevealed(entry.revealed && typeof entry.revealed === "object" ? entry.revealed : {});
          setExplanationLoading(false);
          hadCache = true;
        }
      }
      if (!hadCache) {
        setTopicExplanation("Carregando explicação...");
        setExplanationLoading(true);
        setTopicQuestions(null);
        setQuestionPicks({});
        setQuestionRevealed({});
      }

      const welcome = {
        role: "assistant",
        content: `Você está estudando: ${topic.name}. Pode pedir para explicar melhor, resumir, dar exemplo ou mostrar como isso cai na prova.`,
      };

      try {
        const { data: rows, error: msgErr } = await topicApi.fetchTopicMessages(supabase, topic.id, 40);

        if (msgErr) throw msgErr;

        const history = (rows ?? []).map((r) => ({
          role: r.role,
          content: r.content,
        }));

        setTopicChatMessages(history.length > 0 ? history : [welcome]);
      } catch {
        setTopicChatMessages([welcome]);
      }

      try {
        const { data: existing, error: exErr } = await topicApi.fetchTopicExplanationContent(
          supabase,
          topic.id
        );

        if (exErr) throw exErr;

        if (existing?.content) {
          setTopicExplanation(existing.content);
          setExplanationLoading(false);
        } else {
          const { data: generated, error: fnErr } = await topicApi.invokeGenerateTopicExplanation(
            supabase,
            topic.id,
            payload
          );

          if (fnErr) throw fnErr;
          if (generated?.error) throw new Error(generated.error);

          if (generated?.content) {
            setTopicExplanation(generated.content);
          } else {
            setTopicExplanation(
              topic.description?.trim() || "Não foi possível gerar a explicação. Tente novamente."
            );
          }
        }
      } catch (err) {
        setTopicFlowError(err.message || "Erro ao carregar explicação.");
        setTopicExplanation(
          topic.description?.trim() || "Não foi possível carregar a explicação agora."
        );
      } finally {
        setExplanationLoading(false);
      }

      await activityApi.upsertTopicVisit(supabase, {
        userId: session.user.id,
        topicId: topic.id,
        contestId: contest?.id ?? null,
        subjectId: subject?.id ?? null,
      });
    },
    [session?.user, supabase, userId]
  );

  async function handleSelectTopic(topic) {
    if (!topic?.id || !session?.user) return;

    persistCurrentTopic();

    setSelectedTopic(topic);
    selectedTopicRef.current = topic;
    selectedContestRef.current = selectedContest;
    selectedSubjectRef.current = selectedSubject;
    const payload = buildFullAiPayload(examDate, selectedContest, selectedSubject, topic, learnerMetrics, {
      flowMoment: "explanation",
      learningFeedback: learningFeedbackRef.current,
      contestTree: contestTreeContext,
    });
    await loadTopicExperience(topic, selectedContest, selectedSubject, payload);
  }

  function handlePickContest(contest) {
    persistCurrentTopic();
    setSelectedContest(contest);
    setSelectedSubject(null);
    setSelectedTopic(null);
    setTopicsList([]);
    setTopicExplanation("");
    setTopicChatMessages([]);
    setChatInput("");
    setTopicFlowError("");
    setTopicQuestions(null);
    setQuestionsError("");
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});
    setRecoveryTrainingMeta(null);
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;
  }

  async function handlePickSubject(subject) {
    persistCurrentTopic();
    setSelectedSubject(subject);
    setSelectedTopic(null);
    setTopicExplanation("");
    setTopicChatMessages([]);
    setChatInput("");
    setTopicFlowError("");
    setTopicQuestions(null);
    setQuestionsError("");
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});
    setRecoveryTrainingMeta(null);
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;
    setTopicsList([]);

    const { data, error: topicsError } = await catalogApi.fetchTopicsBySubject(supabase, subject.id);

    if (topicsError) {
      setCatalogError(topicsError.message);
      return;
    }

    setCatalogError("");
    setTopicsList(data ?? []);
  }

  const restoreSessionSnapshot = useCallback(
    async (snap, contestList, opts = {}) => {
      const { allowContestSwitch = false } = opts;
      const { contestId, subjectId, topicId } = snap;
      if (!contestId || !subjectId || !topicId || !session?.user) return false;

      if (!allowContestSwitch) {
        const curContestId = selectedContestRef.current?.id;
        if (curContestId && curContestId !== contestId) return false;
      }

      const contest = contestList.find((c) => c.id === contestId);
      if (!contest) return false;

      setSelectedContest(contest);

      const { data: subjects, error: se } = await catalogApi.fetchSubjectsByContest(supabase, contestId);
      if (se) {
        setCatalogError(se.message);
        return false;
      }
      const subjList = subjects ?? [];
      setSubjectsList(subjList);
      const subject = subjList.find((s) => s.id === subjectId);
      if (!subject) return false;
      setSelectedSubject(subject);

      const { data: topics, error: te } = await catalogApi.fetchTopicsBySubject(supabase, subjectId);
      if (te) {
        setCatalogError(te.message);
        return false;
      }
      const tlist = topics ?? [];
      setTopicsList(tlist);
      const topic = tlist.find((t) => t.id === topicId);
      if (!topic) return false;

      setSelectedTopic(topic);
      selectedContestRef.current = contest;
      selectedSubjectRef.current = subject;
      selectedTopicRef.current = topic;
      const payload = buildFullAiPayload(examDate, contest, subject, topic, learnerMetrics, {
        flowMoment: "explanation",
        learningFeedback: learningFeedbackRef.current,
        contestTree: contestTreeContext,
      });
      await loadTopicExperience(topic, contest, subject, payload);
      const resumeJourney = buildStudyResumeJourney(snap);
      if (resumeJourney?.targetTab === "questions") {
        setStudySubTab("questions");
      } else {
        setStudySubTab("explanation");
      }
      if (resumeJourney?.targetTab === "chat") {
        onRequestWorkspaceSubTab?.("chat");
      }
      return true;
    },
    [session?.user, supabase, examDate, loadTopicExperience, learnerMetrics, onRequestWorkspaceSubTab]
  );

  const contestIdsKey = contests.map((c) => c.id).join(",");

  /** Concurso resolvido antes do paint: idle (main/last) ou contestId do snapshot de tópico — evita coluna de concurso piscando. */
  useLayoutEffect(() => {
    if (!userId || !studyMetaReady || catalogLoading || contests.length === 0) return;

    const ls = readLastStudySession(userId);
    const fromProfile =
      studyMeta?.lastTopicId && studyMeta?.lastContestId && studyMeta?.lastSubjectId
        ? {
            contestId: studyMeta.lastContestId,
            subjectId: studyMeta.lastSubjectId,
            topicId: studyMeta.lastTopicId,
          }
        : null;

    const snap = ls?.topicId ? ls : fromProfile;
    const list = contestsRef.current;

    if (snap?.topicId && snap.contestId) {
      const c = list.find((x) => x.id === snap.contestId);
      if (c && (!selectedContest || selectedContest.id === c.id)) {
        setSelectedContest(c);
      }
      return;
    }

    const mainId = studyMeta?.mainExamId ?? null;
    const lastCid = studyMeta?.lastContestId ?? null;
    const fingerprint = `idle:main:${mainId ?? "none"}:last:${lastCid ?? "none"}`;
    if (lastRestoreFingerprintRef.current === fingerprint) return;

    let c = null;
    if (mainId) c = list.find((x) => x.id === mainId);
    else if (lastCid) c = list.find((x) => x.id === lastCid);
    if (c && (!selectedContest || selectedContest.id === c.id)) {
      setSelectedContest(c);
    }
    lastRestoreFingerprintRef.current = fingerprint;
  }, [
    userId,
    studyMetaReady,
    catalogLoading,
    contestIdsKey,
    studyMeta?.lastTopicId,
    studyMeta?.lastContestId,
    studyMeta?.lastSubjectId,
    studyMeta?.mainExamId,
    selectedContest?.id,
  ]);

  /** Restaura tópico/matéria/concurso quando há última sessão com tópico (assíncrono). */
  useEffect(() => {
    if (!userId || !studyMetaReady || catalogLoading || contests.length === 0) return;

    const ls = readLastStudySession(userId);
    const fromProfile =
      studyMeta?.lastTopicId && studyMeta?.lastContestId && studyMeta?.lastSubjectId
        ? {
            contestId: studyMeta.lastContestId,
            subjectId: studyMeta.lastSubjectId,
            topicId: studyMeta.lastTopicId,
          }
        : null;

    const snap = ls?.topicId ? ls : fromProfile;
    if (!snap?.topicId) return;

    const mainId = studyMeta?.mainExamId ?? null;
    const lastCid = studyMeta?.lastContestId ?? null;
    const fingerprint = `topic:${snap.topicId}`;
    if (lastRestoreFingerprintRef.current === fingerprint) return;

    let cancelled = false;

    (async () => {
      const list = contestsRef.current;
      const ok = await restoreSessionSnapshot(snap, list);
      if (cancelled) return;
      const cur = selectedContestRef.current?.id;
      const contestMismatch = cur && snap.contestId && cur !== snap.contestId;
      if (!ok && !contestMismatch) {
        if (mainId) {
          const c = list.find((x) => x.id === mainId);
          if (c && (!cur || cur === c.id)) setSelectedContest(c);
        } else if (lastCid) {
          const c = list.find((x) => x.id === lastCid);
          if (c && (!cur || cur === c.id)) setSelectedContest(c);
        }
      }
      if (!cancelled) lastRestoreFingerprintRef.current = fingerprint;
    })();

    return () => {
      cancelled = true;
    };
  }, [
    userId,
    studyMetaReady,
    catalogLoading,
    contestIdsKey,
    studyMeta?.lastTopicId,
    studyMeta?.lastContestId,
    studyMeta?.lastSubjectId,
    studyMeta?.mainExamId,
    restoreSessionSnapshot,
  ]);

  const continueWhereILeftOff = useCallback(async () => {
    if (!userId || contests.length === 0) return;
    const ls = readLastStudySession(userId);
    const snap =
      ls?.topicId && ls.contestId && ls.subjectId
        ? ls
        : studyMeta?.lastTopicId
          ? {
              contestId: studyMeta.lastContestId,
              subjectId: studyMeta.lastSubjectId,
              topicId: studyMeta.lastTopicId,
            }
          : null;
    if (!snap?.topicId) return;
    await restoreSessionSnapshot(snap, contests, { allowContestSwitch: true });
  }, [userId, contests, studyMeta, restoreSessionSnapshot]);

  /** Abre matéria/tópico no catálogo (ex.: sugestão do dashboard). Sem novas APIs. */
  const openCatalogTopic = useCallback(
    async (route) => {
      if (!route?.topicId || !route?.subjectId || !route?.contestId || !userId) {
        return false;
      }
      const maxWaitMs = 2800;
      const stepMs = 200;
      let waited = 0;
      while (!contestsRef.current.length && waited < maxWaitMs) {
        await new Promise((r) => setTimeout(r, stepMs));
        waited += stepMs;
      }
      const list = contestsRef.current;
      if (!list.length) return false;
      return restoreSessionSnapshot(
        {
          contestId: route.contestId,
          subjectId: route.subjectId,
          topicId: route.topicId,
        },
        list,
        { allowContestSwitch: true }
      );
    },
    [userId, restoreSessionSnapshot]
  );

  useEffect(() => {
    if (!userId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const qTotal = Array.isArray(topicQuestions) ? topicQuestions.length : 0;
      const qRevealed = qTotal
        ? Object.keys(questionRevealed).filter((k) => questionRevealed[k]).length
        : 0;
      const qWrong = qTotal
        ? Object.keys(questionRevealed).filter((k) => {
            if (!questionRevealed[k]) return false;
            const pick = questionPicks[k];
            const index = Array.isArray(topicQuestions)
              ? topicQuestions.findIndex((q, i) => (q?.id ?? `q-${i}`) === k)
              : -1;
            return index >= 0 && pick !== undefined && pick !== topicQuestions[index]?.correctIndex;
          }).length
        : 0;
      const explanationReady =
        !explanationLoading &&
        Boolean(topicExplanation) &&
        topicExplanation !== "Carregando explicação...";

      const extras =
        persistExtrasRef?.current && typeof persistExtrasRef.current === "object"
          ? persistExtrasRef.current
          : {};
      const resumeMeta = buildStoredStudyResumeMeta({
        activeStudyTab: studySubTab,
        explanationReady,
        quizTotal: qTotal,
        quizRevealed: qRevealed,
        quizWrongCount: qWrong,
        lastStudyUiChat: extras.lastStudyUiChat,
        studySessionContext: studySessionStateRef.current,
        predictedRisk,
        nextBestAction,
        lastAssistantActionType: lastAssistantActionTypeRef.current,
      });
      writeLastStudySession(userId, {
        contestId: selectedContest?.id ?? null,
        subjectId: selectedSubject?.id ?? null,
        topicId: selectedTopic?.id ?? null,
        topicName: selectedTopic?.name ?? null,
        contestName: selectedContest?.name ?? null,
        subjectName: selectedSubject?.name ?? null,
        activeStudyTab: studySubTab,
        quizTotal: qTotal,
        quizRevealed: qRevealed,
        explanationReady,
        ...resumeMeta,
        ...extras,
      });
      void profilesApi
        .updateStudySessionOnProfile(supabase, userId, {
          last_contest_id: selectedContest?.id ?? null,
          last_subject_id: selectedSubject?.id ?? null,
          last_topic_id: selectedTopic?.id ?? null,
        })
        .catch(() => {});
    }, 600);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [
    userId,
    supabase,
    selectedContest?.id,
    selectedSubject?.id,
    selectedTopic?.id,
    studySubTab,
    questionRevealed,
    questionPicks,
    topicQuestions,
    explanationLoading,
    topicExplanation,
    persistExtrasRef,
    studySessionState,
    predictedRisk,
    nextBestAction,
  ]);

  async function startNewTopicChat() {
    const topicId = selectedTopicRef.current?.id;
    const topicName = selectedTopicRef.current?.name?.trim() || "este tópico";
    if (!topicId || !session?.user) return;
    if (chatSending || chatHistoryClearing) return;

    const ok = window.confirm(
      `Apagar toda a conversa com a Yara sobre “${topicName}”? O tópico continua selecionado e você começa um chat novo na hora.`
    );
    if (!ok) return;

    setChatHistoryClearing(true);
    setTopicFlowError("");
    try {
      const { error: delErr } = await topicApi.deleteTopicMessagesForTopic(supabase, topicId);
      if (delErr) throw delErr;
      studySessionPendingStepsRef.current = [];
      setYaraMiniSessionUi(null);
      const freshState = createDefaultStudySessionState();
      studySessionStateRef.current = freshState;
      setStudySessionState(freshState);
      const freshFeedback = createDefaultLearningFeedback();
      learningFeedbackRef.current = freshFeedback;
      setLearningFeedback(freshFeedback);
      lastAssistantActionTypeRef.current = "";
      setTopicChatMessages([]);
      setChatInput("");
    } catch (err) {
      setTopicFlowError(err.message || "Não foi possível apagar o histórico do chat.");
    } finally {
      setChatHistoryClearing(false);
    }
  }

  async function sendTopicChatMessage(overridePrompt, options = {}) {
    const raw = overridePrompt != null ? String(overridePrompt) : chatInput;
    const prompt = raw.trim();
    const topicId = selectedTopicRef.current?.id;
    if (!prompt || !topicId || !session?.user) return;

    const contest = selectedContestRef.current;
    const subject = selectedSubjectRef.current;
    const topic = selectedTopicRef.current;
    const pendingSteps = studySessionPendingStepsRef.current;
    const shouldTrackStudySession = options.trackStudySession !== false;
    const shouldConsumeQuota = options.skipQuota !== true;
    const detectedIntent = detectUserIntent(prompt);
    const nextStudySessionState = shouldTrackStudySession
      ? updateStudySessionState(
          studySessionStateRef.current,
          detectedIntent,
          buildCurrentStudySessionContext()
        )
      : studySessionStateRef.current;
    if (shouldTrackStudySession) {
      studySessionStateRef.current = nextStudySessionState;
      setStudySessionState(nextStudySessionState);
    }

    const studySessionContext = {
      phase: nextStudySessionState.phase,
      confidence: nextStudySessionState.confidence,
      lastUserIntent: nextStudySessionState.lastUserIntent,
      loopCount: nextStudySessionState.loopCount,
      ...(Array.isArray(pendingSteps) && pendingSteps.length > 0 ? { pendingSteps } : {}),
    };
    const explicitFeedback = inferExplicitLearningFeedback(prompt);
    const implicitFeedback = inferImplicitLearningFeedbackFromMessage(prompt, {
      intent: detectedIntent,
      currentSubTab: studySubTab,
      phase: nextStudySessionState.phase,
    });
    const nextLearningFeedback = updateLearningFeedbackState(explicitFeedback, implicitFeedback);
    const basePayload = buildFullAiPayload(examDate, contest, subject, topic, learnerMetrics, {
      flowMoment: resolveFlowMoment(studySessionContext),
      studySessionContext,
      learningFeedback: nextLearningFeedback,
      contestTree: contestTreeContext,
    });
    const payload = { ...basePayload, studySessionContext, learningFeedback: nextLearningFeedback };

    if (overridePrompt == null) setChatInput("");
    setTopicFlowError("");
    setChatSending(true);

    try {
      if (shouldConsumeQuota && featureAccess && !featureAccess.isPro && typeof consumeChatQuota === "function") {
        const chatQuota = await consumeChatQuota(1);
        if (!chatQuota?.allowed) {
          throw new Error(
            chatQuota?.error || "Você atingiu o limite do Yara Inicial para falar com a Yara hoje."
          );
        }
      }

      setTopicChatMessages((prev) => [...prev, { role: "user", content: prompt }]);

      const { data, error: fnErr } = await topicApi.invokeStudyChat(supabase, topicId, prompt, payload);

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      const reply = data?.reply?.trim() || "Sem resposta da IA.";
      const action = data?.action ?? null;
      const nextPending = normalizePendingSessionActionsFromResponse(data?.pendingSessionActions);
      studySessionPendingStepsRef.current = nextPending;
      lastAssistantActionTypeRef.current =
        action && typeof action === "object" && typeof action.type === "string" ? action.type.trim() : "";
      setYaraMiniSessionUi(buildYaraMiniSessionSnapshot(action, nextPending));
      setTopicChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (action && typeof action === "object" && typeof action.type === "string" && onAssistantAction) {
        queueMicrotask(() =>
          onAssistantAction({
            type: action.type.trim(),
            params:
              action.params && typeof action.params === "object" && !Array.isArray(action.params)
                ? action.params
                : {},
          })
        );
      }
    } catch (err) {
      setTopicFlowError(err.message || "Erro no chat.");
      setTopicChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Não consegui responder agora: ${err.message || "erro desconhecido"}.`,
        },
      ]);
    } finally {
      setChatSending(false);
    }
  }

  async function openTopicAndAskWhyStruggling(route, topicName) {
    const ok = await openCatalogTopic(route);
    if (!ok) return false;
    const label = (topicName && String(topicName).trim()) || "este tópico";
    await sendTopicChatMessage(`Explique por que eu estou errando tanto em ${label}. Me ensine de forma simples e prática.`);
    return true;
  }

  const startAdaptiveSimulado = useCallback(
    async (totalQuestions) => {
      const contest = selectedContestRef.current;
      const uid = session?.user?.id;
      if (!contest?.id || !uid) {
        setQuestionsError("Selecione um concurso para rodar o mini simulado.");
        return;
      }
      if (featureAccess && !featureAccess.canUseAdvancedSimulado) {
        setQuestionsError("O mini simulado adaptativo faz parte do Yara Pro.");
        return;
      }
      const n = [5, 8, 10].includes(Number(totalQuestions)) ? Number(totalQuestions) : 8;

      setAdaptiveSimuladoResult(null);
      simuladoFinalizeRef.current = null;
      setRecoveryTrainingMeta(null);
      setRecoveryFeedback(null);
      lastRecoveryFeedbackSessionRef.current = null;
      setQuestionPicks({});
      setQuestionRevealed({});
      setQuizMistakeByKey({});
      setQuestionsError("");
      setTopicFlowError("");
      setTopicQuestions(null);
      setQuestionsLoading(true);

      try {
        const { data: allTopicRows, error: tErr } = await activityApi.fetchAllTopicsForContest(
          supabase,
          contest.id
        );
        if (tErr || !allTopicRows?.length) {
          throw new Error("Não foi possível carregar tópicos deste concurso.");
        }
        const topicById = new Map(allTopicRows.map((t) => [t.id, t]));

        const lm = learnerMetrics?.learningMemory;
        const lmWeak = lm?.weakTopics;
        const nameById = Object.fromEntries(
          allTopicRows.map((t) => [t.id, typeof t.name === "string" ? t.name : ""])
        );
        const recentIds = Array.isArray(lm?.recentStudyTopics)
          ? lm.recentStudyTopics.map((r) => r?.topicId).filter((id) => typeof id === "string" && id.trim())
          : [];
        let rawAlloc =
          buildAdaptiveSimuladoAllocations(Array.isArray(lmWeak) ? lmWeak : [], n, recentIds, nameById) ||
          buildFallbackSimuladoAllocations(allTopicRows, selectedTopicRef.current?.id, n);
        if (!rawAlloc?.length) throw new Error("Não há tópicos suficientes para o simulado.");

        const enriched = rawAlloc
          .map((a) => {
            const row = topicById.get(a.topicId);
            if (!row?.subject_id) return null;
            return {
              topicId: a.topicId,
              topicName: (typeof row.name === "string" && row.name.trim()) || a.topicName,
              count: a.count,
              subjectId: row.subject_id,
            };
          })
          .filter(Boolean);

        if (!enriched.length) {
          throw new Error(
            "Tópicos sugeridos não batem com o catálogo atual. Abra um tópico pelo catálogo e tente de novo."
          );
        }

        const first = enriched[0];
        const opened = await openCatalogTopic({
          contestId: contest.id,
          subjectId: first.subjectId,
          topicId: first.topicId,
        });
        if (!opened) throw new Error("Não foi possível abrir o tópico do simulado. Verifique o catálogo.");

        const sessionId = `simulado-${Date.now()}`;
        setAdaptiveSimuladoMeta({ sessionId, targetTotal: n, contestId: contest.id });
        setStudySubTab("questions");
        onRequestWorkspaceSubTab?.("questions");

        const chunks = expandAllocationChunks(enriched);
        const salt = `${Date.now()}`;
        const results = await Promise.all(
          chunks.map((chunk) => {
            const syntheticTopic = { id: chunk.topicId, name: chunk.topicName };
            const payload = buildFullAiPayload(
              examDate,
              selectedContestRef.current,
              selectedSubjectRef.current,
              syntheticTopic,
              learnerMetrics,
              {
                flowMoment: "pre_questions",
                studySessionContext: studySessionStateRef.current,
                learningFeedback: learningFeedbackRef.current,
                contestTree: contestTreeContext,
              }
            );
            return topicApi.invokeGenerateTopicQuestions(supabase, chunk.topicId, payload, {
              questionCount: chunk.count,
            });
          })
        );

        /** @type {unknown[]} */
        const merged = [];
        for (let ci = 0; ci < results.length; ci++) {
          const { data, error: fnErr } = results[ci];
          if (fnErr) throw fnErr;
          if (data?.error) throw new Error(data.error);
          const qs = data?.questions;
          if (!Array.isArray(qs)) throw new Error("Resposta inválida da função de questões.");
          const chunk = chunks[ci];
          qs.forEach((q, idx) => {
            if (!q || typeof q !== "object") return;
            const baseId = "id" in q && q.id != null ? String(q.id) : `q-${ci}-${idx}`;
            merged.push({
              ...q,
              id: `${baseId}-sim-${salt}`,
              sourceTopicId: chunk.topicId,
              sourceTopicName: chunk.topicName,
            });
          });
        }
        if (!merged.length) throw new Error("Nenhuma questão foi gerada.");

        setTopicQuestions(shuffleArray(merged));
      } catch (err) {
        setAdaptiveSimuladoMeta(null);
        const msg = err.message || "Erro ao montar o mini simulado.";
        setQuestionsError(msg);
        setTopicQuestions(null);
      } finally {
        setQuestionsLoading(false);
      }
    },
    [supabase, session?.user?.id, examDate, learnerMetrics, openCatalogTopic, onRequestWorkspaceSubTab]
  );

  async function generateTopicQuestions() {
    if (!selectedTopic?.id || !session?.user) return;
    if (featureAccess && !featureAccess.canUseQuestions) {
      setQuestionsError("Seu bloco básico de questões do Yara Inicial já foi usado hoje.");
      return;
    }

    setAdaptiveSimuladoMeta(null);
    setAdaptiveSimuladoResult(null);
    simuladoFinalizeRef.current = null;
    setRecoveryTrainingMeta(null);
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;

    setQuestionsLoading(true);
    setQuestionsError("");
    setTopicFlowError("");
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});

    try {
      if (featureAccess && !featureAccess.isPro && typeof consumeQuestionQuota === "function") {
        const quotaResult = await consumeQuestionQuota(3);
        if (!quotaResult?.allowed) {
          throw new Error(quotaResult?.error || "Seu bloco básico de questões do Yara Inicial já foi usado hoje.");
        }
      }

      const { data, error: fnErr } = await topicApi.invokeGenerateTopicQuestions(
        supabase,
        selectedTopic.id,
        aiPayload
      );

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.questions || !Array.isArray(data.questions)) {
        throw new Error("Resposta inválida da função de questões.");
      }

      setTopicQuestions(data.questions);
    } catch (err) {
      const msg = err.message || "Erro ao gerar questões.";
      setQuestionsError(msg);
      setTopicQuestions(null);
    } finally {
      setQuestionsLoading(false);
    }
  }

  async function startRecoveryTraining(questionKey) {
    if (!selectedTopic?.id || !session?.user) return;
    if (featureAccess && !featureAccess.canUseBasicRecovery) {
      setQuestionsError("A continuação da recuperação fica disponível no Yara Pro.");
      return;
    }

    setAdaptiveSimuladoMeta(null);
    setAdaptiveSimuladoResult(null);
    simuladoFinalizeRef.current = null;

    const insight = quizMistakeByKey[questionKey];
    const hasInsight =
      insight &&
      !insight.loading &&
      !insight.error &&
      (insight.mistakeSummary || insight.whyCorrect || insight.likelyConfusion);

    if (!hasInsight) {
      await generateTopicQuestions();
      return;
    }

    const pick = questionPicks[questionKey];
    if (pick === undefined || !Array.isArray(topicQuestions)) return;
    const qi = topicQuestions.findIndex((qq, i) => (qq.id ?? `q-${i}`) === questionKey);
    if (qi < 0) return;
    const q = topicQuestions[qi];
    const correct = q.correctIndex;
    if (pick === correct) return;

    const options = Array.isArray(q.options) ? q.options : [];
    const sessionId = `rec-${Date.now()}-${questionKey}`;

    setQuestionsLoading(true);
    setQuestionsError("");
    setTopicFlowError("");
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});

    setRecoveryTrainingMeta({
      sessionId,
      originQuestionKey: questionKey,
      mistakeSummary: insight.mistakeSummary || "",
      likelyConfusion: insight.likelyConfusion || "",
      whyCorrect: insight.whyCorrect || "",
      questionStem: q.question != null ? String(q.question) : "",
      wrongLabel: options[pick] != null ? String(options[pick]) : "",
      correctLabel: options[correct] != null ? String(options[correct]) : "",
    });

    try {
      if (featureAccess && !featureAccess.isPro && typeof consumeRecoverySession === "function") {
        const recoveryQuota = await consumeRecoverySession(1);
        if (!recoveryQuota?.allowed) {
          throw new Error(recoveryQuota?.error || "A continuação da recuperação fica disponível no Yara Pro.");
        }
      }

      const { data, error: fnErr } = await topicApi.invokeGenerateTopicQuestions(
        supabase,
        selectedTopic.id,
        aiPayload,
        {
          recoveryMode: true,
          recoveryQuestionCount: 3,
          recoveryContext: {
            mistakeSummary: insight.mistakeSummary || "",
            likelyConfusion: insight.likelyConfusion || "",
            whyCorrect: insight.whyCorrect || "",
            questionStem: q.question != null ? String(q.question) : "",
            selectedLabel: options[pick] != null ? String(options[pick]) : "",
            correctLabel: options[correct] != null ? String(options[correct]) : "",
          },
        }
      );

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (!data?.questions || !Array.isArray(data.questions)) {
        throw new Error("Resposta inválida da função de questões.");
      }

      setTopicQuestions(data.questions);
    } catch (err) {
      const msg = err.message || "Erro ao gerar mini treino.";
      setQuestionsError(msg);
      setTopicQuestions(null);
      setRecoveryTrainingMeta(null);
    } finally {
      setQuestionsLoading(false);
    }
  }

  useEffect(() => {
    if (!recoveryTrainingMeta) {
      lastRecoveryFeedbackSessionRef.current = null;
      setRecoveryFeedback(null);
      return;
    }
    if (!Array.isArray(topicQuestions) || topicQuestions.length === 0) return;

    const keys = topicQuestions.map((q, i) => q.id ?? `q-${i}`);
    const allRevealed = keys.length > 0 && keys.every((k) => questionRevealed[k]);
    if (!allRevealed) return;

    const sid = recoveryTrainingMeta.sessionId;
    if (lastRecoveryFeedbackSessionRef.current === sid) return;

    let correct = 0;
    for (let i = 0; i < topicQuestions.length; i++) {
      const qq = topicQuestions[i];
      const k = qq.id ?? `q-${i}`;
      if (questionPicks[k] === qq.correctIndex) correct += 1;
    }

    lastRecoveryFeedbackSessionRef.current = sid;
    setRecoveryFeedback(pickRecoveryTrainingFeedback(correct, topicQuestions.length));
  }, [recoveryTrainingMeta, topicQuestions, questionRevealed, questionPicks]);

  function resetTopicQuestions() {
    setTopicQuestions(null);
    setQuestionsError("");
    setQuestionPicks({});
    setQuestionRevealed({});
    setQuizMistakeByKey({});
    setAdaptiveSimuladoMeta(null);
    setAdaptiveSimuladoResult(null);
    simuladoFinalizeRef.current = null;
    setRecoveryTrainingMeta(null);
    setRecoveryFeedback(null);
    lastRecoveryFeedbackSessionRef.current = null;
    const tid = selectedTopic?.id;
    if (userId && tid) {
      const all = readTopicCache(userId);
      if (all[tid]) {
        delete all[tid].questions;
        delete all[tid].questionsError;
        delete all[tid].picks;
        delete all[tid].revealed;
        all[tid] = { ...all[tid], questions: null, questionsError: "", picks: {}, revealed: {} };
        writeTopicCache(userId, all);
      }
    }
  }

  function setQuestionPick(questionKey, optionIndex) {
    setQuestionPicks((prev) => ({ ...prev, [questionKey]: optionIndex }));
  }

  const loadQuizMistakeForWrongAnswer = useCallback(
    async (questionKey, q, pick, correct, topicId, topicName, simplify = false) => {
      if (!userId || !topicId || !session?.user) return;
      const topicIdAtStart = topicId;
      const options = Array.isArray(q.options) ? q.options : [];
      const questionStem = q.question != null ? String(q.question) : "";
      const selectedLabel = options[pick] != null ? String(options[pick]) : "";
      const correctLabel = options[correct] != null ? String(options[correct]) : "";
      const payload = buildFullAiPayload(
        examDate,
        selectedContestRef.current,
        selectedSubjectRef.current,
        selectedTopicRef.current,
        learnerMetrics,
        {
          flowMoment: studySubTab === "questions" ? "pre_questions" : "chat",
          studySessionContext: studySessionStateRef.current,
          learningFeedback: learningFeedbackRef.current,
          contestTree: contestTreeContext,
        }
      );

      setQuizMistakeByKey((prev) => ({
        ...prev,
        [questionKey]: {
          ...prev[questionKey],
          loading: true,
          error: undefined,
        },
      }));

      try {
        const { data, error: fnErr } = await topicApi.invokeExplainQuizMistake(
          supabase,
          {
            topicId,
            questionStem,
            options,
            selectedIndex: pick,
            correctIndex: correct,
            selectedLabel,
            correctLabel,
            topicName: topicName != null ? String(topicName) : "",
            simplify,
          },
          payload
        );

        if (selectedTopicRef.current?.id !== topicIdAtStart) return;

        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        setQuizMistakeByKey((prev) => ({
          ...prev,
          [questionKey]: {
            loading: false,
            mistakeSummary: data?.mistakeSummary,
            whyCorrect: data?.whyCorrect,
            likelyConfusion: data?.likelyConfusion,
            simplified: Boolean(simplify),
          },
        }));
      } catch (err) {
        if (selectedTopicRef.current?.id !== topicIdAtStart) return;
        setQuizMistakeByKey((prev) => ({
          ...prev,
          [questionKey]: {
            ...prev[questionKey],
            loading: false,
            error: err.message || "Não foi possível gerar a explicação.",
          },
        }));
      }
    },
    [userId, session?.user, supabase, examDate, learnerMetrics, studySubTab]
  );

  const requestSimplerQuizMistake = useCallback(
    (questionKey) => {
      if (adaptiveSimuladoMeta) return;
      if (!selectedTopic?.id || !Array.isArray(topicQuestions)) return;
      const pick = questionPicks[questionKey];
      const qi = topicQuestions.findIndex((qq, i) => (qq.id ?? `q-${i}`) === questionKey);
      if (qi < 0 || pick === undefined) return;
      const q = topicQuestions[qi];
      const correct = q.correctIndex;
      if (pick === correct) return;
      void loadQuizMistakeForWrongAnswer(
        questionKey,
        q,
        pick,
        correct,
        selectedTopic.id,
        selectedTopic.name,
        true
      );
    },
    [
      adaptiveSimuladoMeta,
      selectedTopic?.id,
      selectedTopic?.name,
      topicQuestions,
      questionPicks,
      loadQuizMistakeForWrongAnswer,
    ]
  );

  const handleQuestionReveal = useCallback(
    (questionKey) => {
      setQuestionRevealed((prev) => ({ ...prev, [questionKey]: true }));
      if (!userId || !selectedTopic?.id || !Array.isArray(topicQuestions) || !topicQuestions.length) return;
      const pick = questionPicks[questionKey];
      if (pick === undefined) return;
      const qi = topicQuestions.findIndex((qq, i) => (qq.id ?? `q-${i}`) === questionKey);
      if (qi < 0) return;
      const q = topicQuestions[qi];
      const correct = q.correctIndex;
      const isCorrect = pick === correct;
      updateLearningFeedbackState(
        inferImplicitLearningFeedbackFromQuiz({
          isCorrect,
          preferredNextMove: learningFeedbackRef.current.preferredNextMove,
          studentConfidence: learningFeedbackRef.current.studentConfidence,
        })
      );
      const options = Array.isArray(q.options) ? q.options : [];
      const selectedLabel = options[pick] != null ? String(options[pick]) : "";
      const correctLabel = options[correct] != null ? String(options[correct]) : "";
      const questionStem = q.question != null ? String(q.question) : "";
      const recordTopicId =
        typeof q.sourceTopicId === "string" && q.sourceTopicId.trim()
          ? q.sourceTopicId.trim()
          : selectedTopic.id;
      const recordTopicName =
        typeof q.sourceTopicName === "string" && q.sourceTopicName.trim()
          ? q.sourceTopicName.trim()
          : selectedTopic.name;
      const inSimulado = Boolean(adaptiveSimuladoMeta);
      activityApi.insertQuestionAttempt(supabase, {
        userId,
        topicId: recordTopicId,
        questionKey,
        selectedIndex: pick,
        correctIndex: correct,
        isCorrect,
        questionStem,
        selectedLabel,
        correctLabel,
      }).catch(() => {});
      if (!isCorrect) {
        onWrongAttemptRecorded?.();
        if (!inSimulado) {
          void loadQuizMistakeForWrongAnswer(
            questionKey,
            q,
            pick,
            correct,
            recordTopicId,
            recordTopicName,
            false
          );
        }
      } else {
        setQuizMistakeByKey((prev) => {
          if (!prev[questionKey]) return prev;
          const next = { ...prev };
          delete next[questionKey];
          return next;
        });
      }
      onQuestionRevealed?.({ topicId: recordTopicId, isCorrect });
    },
    [
      userId,
      selectedTopic?.id,
      selectedTopic?.name,
      topicQuestions,
      questionPicks,
      supabase,
      onWrongAttemptRecorded,
      onQuestionRevealed,
      loadQuizMistakeForWrongAnswer,
      adaptiveSimuladoMeta,
      updateLearningFeedbackState,
    ]
  );

  useEffect(() => {
    if (!adaptiveSimuladoMeta || !Array.isArray(topicQuestions) || !topicQuestions.length) return;
    const keys = topicQuestions.map((q, i) => q.id ?? `q-${i}`);
    if (!keys.length || !keys.every((k) => questionRevealed[k])) return;
    const sessionId = adaptiveSimuladoMeta.sessionId;
    if (simuladoFinalizeRef.current === sessionId) return;
    simuladoFinalizeRef.current = sessionId;

    let correct = 0;
    const byTopic = new Map();
    for (let i = 0; i < topicQuestions.length; i++) {
      const q = topicQuestions[i];
      const k = q.id ?? `q-${i}`;
      const tid =
        (typeof q.sourceTopicId === "string" && q.sourceTopicId.trim()) ||
        selectedTopicRef.current?.id ||
        "";
      const tname =
        (typeof q.sourceTopicName === "string" && q.sourceTopicName.trim()) ||
        selectedTopicRef.current?.name ||
        "Tópico";
      const isOk = questionPicks[k] === q.correctIndex;
      if (isOk) correct += 1;
      if (!byTopic.has(tid)) byTopic.set(tid, { name: tname, c: 0, t: 0 });
      const row = byTopic.get(tid);
      row.t += 1;
      if (isOk) row.c += 1;
    }

    const total = topicQuestions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const contestId = adaptiveSimuladoMeta.contestId;
    const uidStore = session?.user?.id;
    if (uidStore && contestId) {
      writeLastSimuladoSession(uidStore, contestId, { correct, total, pct });
    }

    const scored = [...byTopic.entries()].map(([id, v]) => ({
      id,
      name: v.name,
      pct: v.t ? Math.round((v.c / v.t) * 100) : 0,
      t: v.t,
    }));
    scored.sort((a, b) => b.pct - a.pct || b.t - a.t);
    const bestLabels = scored.filter((s) => s.t > 0).slice(0, 2).map((s) => s.name);
    const distinctTopics = new Set(scored.map((s) => s.id).filter(Boolean));
    const bestSet = new Set(bestLabels);
    let worstLabels = [...scored]
      .sort((a, b) => a.pct - b.pct || a.t - b.t)
      .filter((s) => s.t > 0 && !bestSet.has(s.name))
      .slice(0, 2)
      .map((s) => s.name);
    if (distinctTopics.size <= 1) {
      worstLabels = [];
    }

    setAdaptiveSimuladoResult({
      sessionId,
      correct,
      total,
      pct,
      bestLabels,
      worstLabels,
    });
    onAdaptiveSimuladoComplete?.();

    const debriefPrompt = buildSimuladoYaraUserPrompt({
      correct,
      total,
      pct,
      bestLabels,
      worstLabels,
    });
    void sendTopicChatMessage(debriefPrompt, { trackStudySession: false, skipQuota: true });
    // sendTopicChatMessage é estável na prática; omitido do array para evitar loop.
  }, [
    adaptiveSimuladoMeta,
    topicQuestions,
    questionRevealed,
    questionPicks,
    session?.user?.id,
    onAdaptiveSimuladoComplete,
  ]);

  const createUserContest = useCallback(
    async (name) => {
      if (!session?.user?.id || !name?.trim()) return { data: null, error: new Error("Nome inválido") };
      return catalogApi.createUserContest(supabase, {
        name: name.trim(),
        ownerUserId: session.user.id,
      });
    },
    [session?.user?.id, supabase]
  );

  const addSubjectToContest = useCallback(
    (contestId, name) => catalogApi.createSubject(supabase, { contestId, name }),
    [supabase]
  );

  const addTopicToSubject = useCallback(
    (subjectId, name, description) =>
      catalogApi.createTopic(supabase, { subjectId, name, description }),
    [supabase]
  );

  const reloadContests = useCallback(async () => {
    const { data, error } = await catalogApi.fetchContests(supabase);
    if (!error && data) setContests(data);
    return { data, error };
  }, [supabase]);

  const fetchContestsCatalog = useCallback(() => catalogApi.fetchContestsCatalog(supabase), [supabase]);

  const searchContests = useCallback((query) => catalogApi.searchContests(supabase, query), [supabase]);

  const getSuggestedContests = useCallback(
    (area) => catalogApi.getSuggestedContests(supabase, area),
    [supabase]
  );

  const fetchPublicContestCatalogTree = useCallback(
    (contestCatalogId) => catalogApi.fetchPublicContestCatalogTree(supabase, contestCatalogId),
    [supabase]
  );

  const ensureRuntimeContestFromCatalog = useCallback(
    (contestCatalogId) => catalogApi.ensureRuntimeContestFromCatalog(supabase, contestCatalogId),
    [supabase]
  );

  return {
    catalogError,
    topicFlowError,
    catalogLoading,
    explanationLoading,
    chatSending,
    contests,
    subjectsList,
    topicsList,
    selectedContest,
    selectedSubject,
    selectedTopic,
    topicExplanation,
    topicChatMessages,
    yaraMiniSessionUi,
    chatInput,
    setChatInput,
    startNewTopicChat,
    chatHistoryClearing,
    handlePickContest,
    handlePickSubject,
    handleSelectTopic,
    sendTopicChatMessage,
    generateTopicQuestions,
    resetTopicQuestions,
    topicQuestions,
    questionsLoading,
    questionsError,
    questionPicks,
    questionRevealed,
    quizMistakeByKey,
    setQuestionPick,
    handleQuestionReveal,
    requestSimplerQuizMistake,
    startRecoveryTraining,
    recoveryTrainingMeta,
    recoveryFeedback,
    onStudySubTabChange,
    studySubTab,
    studySessionState,
    resetAll,
    continueWhereILeftOff,
    createUserContest,
    addSubjectToContest,
    addTopicToSubject,
    reloadContests,
    fetchContestsCatalog,
    searchContests,
    getSuggestedContests,
    fetchPublicContestCatalogTree,
    ensureRuntimeContestFromCatalog,
    openCatalogTopic,
    openTopicAndAskWhyStruggling,
    startAdaptiveSimulado,
    adaptiveSimuladoMeta,
    adaptiveSimuladoResult,
  };
}
