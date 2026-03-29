import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as authApi from "./api/authApi.js";
import { AppMainNav } from "./components/AppMainNav.jsx";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { DashboardHeader } from "./components/DashboardHeader.jsx";
import { DashboardStudyHub } from "./components/DashboardStudyHub.jsx";
import { CosmicTransition } from "./components/CosmicTransition.jsx";
import { LandingPage } from "./components/LandingPage.jsx";
import { LoadingScreen } from "./components/LoadingScreen.jsx";
import { OrganicScene } from "./components/OrganicScene.jsx";
import { OrganicSectionsShowcase } from "./components/OrganicSectionsShowcase.jsx";
import { OnboardingModal } from "./components/OnboardingModal.jsx";
import { ProfileOrganicPanel } from "./components/ProfileOrganicPanel.jsx";
import { StudyAreaPanel } from "./components/StudyAreaPanel.jsx";
import { useAccountProfile } from "./hooks/useAccountProfile.js";
import { useAuthSession } from "./hooks/useAuthSession.js";
import { useDashboardStudy } from "./hooks/useDashboardStudy.js";
import { useFeatureAccess } from "./hooks/useFeatureAccess.js";
import { useLearnerMemoryForAi } from "./hooks/useLearnerMemoryForAi.js";
import { useSubscription } from "./hooks/useSubscription.js";
import { useStudyArea } from "./hooks/useStudyArea.js";
import { useUsageQuota } from "./hooks/useUsageQuota.js";
import { AdminContestsPage } from "./pages/AdminContestsPage.jsx";
import * as activityApi from "./api/studyActivityApi.js";
import { supabase } from "./lib/supabaseClient.js";
import { styles } from "./styles/appStyles.js";
import { computeDaysUntilExam, examCountdownLabel } from "./utils/examDate.js";
import { buildDashboardCommandCenter } from "./utils/dashboardCommandCenter.js";
import { buildStudyResumeJourney } from "./utils/studyResumeJourney.js";
import { getErrorInsights, generateStudyRecommendation } from "./utils/studyErrorInsights.js";
import { generateStudyMission, MISSION_PRACTICE_TARGET } from "./utils/studyMission.js";
import { readLastStudySession } from "./utils/studySessionStorage.js";
import { validateYaraAction } from "./utils/yaraActions.js";
import { buildExamReadinessFromLearningMemoryRaw } from "./utils/examReadiness.js";
import { daysSinceIso, readLastSimuladoSession } from "./utils/simuladoHintStorage.js";
import { describeSignupResult, normalizeAuthError } from "./utils/authFeedback.js";

function App() {
  const [mode, setMode] = useState("register");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [authFeedback, setAuthFeedback] = useState(null);
  const [mainTab, setMainTab] = useState("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [studyResumeBannerDismissed, setStudyResumeBannerDismissed] = useState(false);
  const [studyScrollSignal, setStudyScrollSignal] = useState(0);
  const [studySubTabBoost, setStudySubTabBoost] = useState(null);
  const [studyFocusMode, setStudyFocusMode] = useState(false);
  /** Última intenção explícita de foco na faixa do chat (persistido só com mainTab === "study"). */
  const [lastStudyUiChat, setLastStudyUiChat] = useState(false);
  const [navHydrated, setNavHydrated] = useState(false);
  const persistExtrasRef = useRef({});
  const openChatAfterHydrateRef = useRef(false);
  const [studyReviewMode, setStudyReviewMode] = useState("normal");
  const [studyReviewItems, setStudyReviewItems] = useState([]);
  const [studyReviewLoading, setStudyReviewLoading] = useState(false);
  const [studyReviewError, setStudyReviewError] = useState("");
  const [studyReviewEmptyHint, setStudyReviewEmptyHint] = useState("");
  const [studyInsightRows, setStudyInsightRows] = useState([]);
  const [studyInsightsLoading, setStudyInsightsLoading] = useState(false);
  const [studyInsightsError, setStudyInsightsError] = useState("");
  const [studyInsightsRefreshNonce, setStudyInsightsRefreshNonce] = useState(0);
  const [studyTabEnterNonce, setStudyTabEnterNonce] = useState(0);
  const [simuladoReadinessTick, setSimuladoReadinessTick] = useState(0);
  const prevMainTabRef = useRef("dashboard");
  /** Feedback discreto quando a Yara executa uma ação (`study` = faixa do chat; `dashboard` = painel). */
  const [yaraUiActionHint, setYaraUiActionHint] = useState(null);
  const yaraUiActionHintTimerRef = useRef(null);
  const yaraUiActionHintIdRef = useRef(0);
  /** landing → (transição cósmica) → auth — só sem sessão */
  const [preAuthPhase, setPreAuthPhase] = useState("landing");
  const [transitionActive, setTransitionActive] = useState(false);
  const [pendingAuthMode, setPendingAuthMode] = useState(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");
  const transitionLockRef = useRef(false);
  const transitionTimersRef = useRef([]);

  const clearAuthTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((id) => clearTimeout(id));
    transitionTimersRef.current = [];
  }, []);

  useEffect(() => () => clearAuthTransitionTimers(), [clearAuthTransitionTimers]);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "profile") {
      setMainTab("profile");
      window.history.replaceState({}, "", window.location.pathname || "/");
    }
  }, []);

  useEffect(
    () => () => {
      if (yaraUiActionHintTimerRef.current) {
        clearTimeout(yaraUiActionHintTimerRef.current);
        yaraUiActionHintTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (mainTab !== "study") {
      setYaraUiActionHint((h) => (h?.surface === "study" ? null : h));
    }
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== "dashboard") {
      setYaraUiActionHint((h) => (h?.surface === "dashboard" ? null : h));
    }
  }, [mainTab]);

  const startAuthTransition = useCallback(
    (nextMode) => {
      if (transitionLockRef.current) return;
      transitionLockRef.current = true;
      clearAuthTransitionTimers();
      setError("");
      setMessage("");
      setAuthFeedback(null);
      setMode(nextMode);
      setPendingAuthMode(nextMode);
      setTransitionActive(true);
      setAuthVisible(false);

      const t1 = window.setTimeout(() => setPreAuthPhase("auth"), 950);
      const t2 = window.setTimeout(() => setAuthVisible(true), 1080);
      const t3 = window.setTimeout(() => {
        setTransitionActive(false);
        setPendingAuthMode(null);
        transitionLockRef.current = false;
      }, 1650);
      transitionTimersRef.current = [t1, t2, t3];
    },
    [clearAuthTransitionTimers]
  );

  const handleBackToLanding = useCallback(() => {
    clearAuthTransitionTimers();
    transitionLockRef.current = false;
    setTransitionActive(false);
    setPendingAuthMode(null);
    setAuthVisible(false);
    setError("");
    setMessage("");
    setAuthFeedback(null);
    setPreAuthPhase("landing");
  }, [clearAuthTransitionTimers]);

  const navigateToPath = useCallback((nextPath) => {
    const resolvedPath = nextPath?.trim() || "/";
    if (window.location.pathname !== resolvedPath) {
      window.history.pushState({}, "", resolvedPath);
      setPathname(resolvedPath);
    }
  }, []);

  const setErrorStable = useCallback((msg) => setError(msg), []);

  const { session, loading } = useAuthSession(setErrorStable);

  const profile = useAccountProfile(supabase, setErrorStable);
  const subscription = useSubscription(supabase, session);
  const usageQuota = useUsageQuota(supabase, session, subscription.access);
  const featureAccess = useFeatureAccess(subscription.access, usageQuota.usage);

  const mainExamIdForDash = profile.mainExamId?.trim() || null;
  const pinnedContestId =
    mainExamIdForDash || profile.studyMeta?.lastContestId?.trim() || null;

  const dashboard = useDashboardStudy(supabase, session, {
    examDate: profile.examDate,
    mainExamId: mainExamIdForDash,
    hoursPerDay: profile.hours,
  });

  const bumpStudyInsightsRefresh = useCallback(() => {
    setStudyInsightsRefreshNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const prev = prevMainTabRef.current;
    prevMainTabRef.current = mainTab;
    if (mainTab === "study" && prev !== "study") {
      setStudyTabEnterNonce((n) => n + 1);
    }
  }, [mainTab]);

  const learnerMemoryRefreshKey = studyInsightsRefreshNonce + studyTabEnterNonce;

  const learnerMemoryBundle = useLearnerMemoryForAi(
    supabase,
    session?.user?.id ?? null,
    mainExamIdForDash,
    learnerMemoryRefreshKey
  );

  const examReadiness = useMemo(() => {
    const uid = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
    const cid = typeof pinnedContestId === "string" ? pinnedContestId.trim() : "";
    const last = uid && cid ? readLastSimuladoSession(uid, cid) : null;
    const hint = last ? { pct: last.pct, ageDays: daysSinceIso(last.at) } : null;
    return buildExamReadinessFromLearningMemoryRaw(learnerMemoryBundle.learningMemory, hint);
  }, [learnerMemoryBundle.learningMemory, session?.user?.id, pinnedContestId, simuladoReadinessTick]);

  const topicErrorInsights = useMemo(() => getErrorInsights(studyInsightRows), [studyInsightRows]);

  const openTopicHintsForYara = useMemo(
    () =>
      topicErrorInsights
        .filter((i) => i.topic_id && i.subject_id && i.contest_id)
        .slice(0, 6)
        .map((i) => ({
          topicId: i.topic_id,
          subjectId: i.subject_id,
          contestId: i.contest_id,
          topicName: i.topic_name,
        })),
    [topicErrorInsights]
  );

  const openTopicHintsForValidation = useMemo(
    () =>
      openTopicHintsForYara.map((h) => ({
        topicId: h.topicId,
        subjectId: h.subjectId,
        contestId: h.contestId,
      })),
    [openTopicHintsForYara]
  );

  const learnerMetricsForAi = useMemo(
    () => ({
      hoursPerDay: profile.hours,
      topicsStudied: dashboard.topicsStudiedMain,
      topicsTotal: dashboard.topicsTotal,
      questionsAnswered: dashboard.quizAttempts,
      questionsCorrect: dashboard.quizCorrect,
      ...(openTopicHintsForYara.length ? { openTopicHints: openTopicHintsForYara } : {}),
      ...(learnerMemoryBundle.learningMemory
        ? {
            learningMemory: learnerMemoryBundle.learningMemory,
            topicQuizStatsByTopicId: learnerMemoryBundle.topicStatsById,
          }
        : {}),
      ...(examReadiness ? { examReadiness } : {}),
    }),
    [
      profile.hours,
      dashboard.topicsStudiedMain,
      dashboard.topicsTotal,
      dashboard.quizAttempts,
      dashboard.quizCorrect,
      openTopicHintsForYara,
      learnerMemoryBundle.learningMemory,
      learnerMemoryBundle.topicStatsById,
      examReadiness,
    ]
  );

  const yaraActionRunnerRef = useRef(null);
  const queueYaraAssistantAction = useCallback((action) => {
    queueMicrotask(() => {
      const run = yaraActionRunnerRef.current;
      if (run && action) void run(action);
    });
  }, []);
  const studyRecommendation = useMemo(
    () => generateStudyRecommendation(topicErrorInsights, learnerMemoryBundle.topicStatsById),
    [topicErrorInsights, learnerMemoryBundle.topicStatsById]
  );
  const studyMission = useMemo(
    () => generateStudyMission(topicErrorInsights, learnerMemoryBundle.topicStatsById),
    [topicErrorInsights, learnerMemoryBundle.topicStatsById]
  );
  const studyMissionRef = useRef(studyMission);
  studyMissionRef.current = studyMission;

  const [missionProgress, setMissionProgress] = useState({});
  const prevMissionIdRef = useRef("");

  useEffect(() => {
    const id = studyMission?.id ?? "";
    if (id === prevMissionIdRef.current) return;
    prevMissionIdRef.current = id;
    setMissionProgress({});
  }, [studyMission?.id]);

  const onQuestionRevealedForMission = useCallback(({ topicId, isCorrect }) => {
    if (!isCorrect) return;
    const m = studyMissionRef.current;
    if (!m?.topic_id || topicId !== m.topic_id) return;
    setMissionProgress((prev) => {
      const current = typeof prev.practice === "number" ? prev.practice : 0;
      const next = Math.min(MISSION_PRACTICE_TARGET, current + 1);
      return { ...prev, practice: next };
    });
  }, []);

  const handleQuizQuestionRevealed = useCallback(
    (payload) => {
      bumpStudyInsightsRefresh();
      onQuestionRevealedForMission(payload);
    },
    [bumpStudyInsightsRefresh, onQuestionRevealedForMission]
  );

  const study = useStudyArea(
    supabase,
    session,
    profile.examDate,
    profile.studyMeta,
    profile.studyMetaReady,
    learnerMetricsForAi,
    {
      onQuestionRevealed: handleQuizQuestionRevealed,
      persistExtrasRef,
      onAssistantAction: queueYaraAssistantAction,
      onRequestWorkspaceSubTab: (tab) => {
        if (typeof tab === "string") {
          requestAnimationFrame(() => setStudySubTabBoost(tab));
        }
      },
      onAdaptiveSimuladoComplete: () => {
        setSimuladoReadinessTick((n) => n + 1);
      },
      featureAccess,
      consumeChatQuota: usageQuota.consumeChatQuota,
      consumeQuestionQuota: usageQuota.consumeQuestionQuota,
      consumeRecoverySession: usageQuota.consumeRecoverySession,
    }
  );

  useLayoutEffect(() => {
    if (loading) return;
    if (!session?.user?.id) {
      openChatAfterHydrateRef.current = false;
      setNavHydrated(true);
      return;
    }
    const snap = readLastStudySession(session.user.id);
    openChatAfterHydrateRef.current = false;
    if (snap && typeof snap === "object") {
      const mt = snap.mainTab;
      if (mt === "dashboard" || mt === "study" || mt === "profile") {
        setMainTab(mt);
      }
      setStudyFocusMode(snap.studyFocusMode === true);
      const wantChat =
        snap.lastStudyUiChat === true && snap.mainTab === "study" && Boolean(snap.topicId);
      setLastStudyUiChat(wantChat);
      if (wantChat) openChatAfterHydrateRef.current = true;
    }
    setNavHydrated(true);
  }, [loading, session?.user?.id]);

  useEffect(() => {
    if (!openChatAfterHydrateRef.current) return;
    if (mainTab !== "study" || !study.selectedTopic?.id) return;
    openChatAfterHydrateRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setStudySubTabBoost("chat"));
    });
  }, [mainTab, study.selectedTopic?.id]);

  useEffect(() => {
    const tid = study.selectedTopic?.id;
    const mid = studyMission?.topic_id;
    if (!tid || !mid || tid !== mid) return;
    setMissionProgress((p) => (p.review ? p : { ...p, review: true }));
  }, [study.selectedTopic?.id, studyMission?.topic_id]);

  const examCountdownText = examCountdownLabel(profile.examDate);

  const chatUserDisplayName = useMemo(() => {
    const fromProfile = profile.name?.trim();
    if (fromProfile) return fromProfile;
    const meta = session?.user?.user_metadata;
    const fromMetaName = typeof meta?.name === "string" ? meta.name.trim() : "";
    if (fromMetaName) return fromMetaName;
    const fromFull = typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
    if (fromFull) return fromFull;
    return "Você";
  }, [profile.name, session?.user?.user_metadata?.name, session?.user?.user_metadata?.full_name]);

  const profileExamSummary = useMemo(() => {
    const d = computeDaysUntilExam(profile.examDate);
    if (d === null) return "Defina no perfil";
    if (d < 0) return `${Math.abs(d)}d atrás`;
    if (d === 0) return "É hoje";
    return `Faltam ${d} dias`;
  }, [profile.examDate]);

  const mainExamName = useMemo(() => {
    if (!mainExamIdForDash) return "";
    const c = study.contests.find((x) => x.id === mainExamIdForDash);
    return c?.name ?? "";
  }, [study.contests, mainExamIdForDash]);

  const planProgressAligned = useMemo(
    () => Boolean(mainExamIdForDash && study.selectedContest?.id === mainExamIdForDash),
    [mainExamIdForDash, study.selectedContest?.id]
  );

  const weeklyMetaLine = useMemo(() => {
    const h = profile.hours != null && profile.hours !== "" ? String(profile.hours) : "2";
    return `Baseado na sua meta semanal (${h.replace("+", "")} h/dia no perfil).`;
  }, [profile.hours]);

  const lastTopicLabel = useMemo(() => {
    const ls = dashboard.lastLocal;
    if (ls?.topicName) return ls.topicName;
    if (ls?.topicId && study.selectedTopic?.id === ls.topicId) return study.selectedTopic.name;
    return "";
  }, [dashboard.lastLocal, study.selectedTopic]);

  const canContinueStudy = Boolean(
    dashboard.lastLocal?.topicId ||
      (profile.studyMeta?.lastTopicId &&
        profile.studyMeta?.lastContestId &&
        profile.studyMeta?.lastSubjectId)
  );

  const studyNowHint = useMemo(() => {
    if (canContinueStudy && lastTopicLabel) {
      return `Retomamos “${lastTopicLabel}” — é só começar.`;
    }
    if (canContinueStudy) {
      return "Voltamos pro seu último tópico salvo.";
    }
    if (dashboard.suggestedStudyRoute) {
      return "Abrimos o tópico que mais faz sentido pra hoje.";
    }
    return "Abra matéria e tópico — ou ajuste o perfil se faltar concurso.";
  }, [canContinueStudy, lastTopicLabel, dashboard.suggestedStudyRoute]);

  const studyResumeJourney = useMemo(
    () =>
      buildStudyResumeJourney(dashboard.lastLocal, dashboard.continueProgressLine, {
        examReadiness,
        examCountdownText,
        examCountdownDays: computeDaysUntilExam(profile.examDate),
        recentRows: dashboard.recentRows,
        evolutionLines: dashboard.evolutionLines,
        weakTopics: learnerMemoryBundle.learningMemory?.weakTopics,
      }),
    [
      dashboard.lastLocal,
      dashboard.continueProgressLine,
      examReadiness,
      examCountdownText,
      profile.examDate,
      dashboard.recentRows,
      dashboard.evolutionLines,
      learnerMemoryBundle.learningMemory?.weakTopics,
    ]
  );

  const dashboardCommandCenter = useMemo(
    () =>
      buildDashboardCommandCenter({
        dashboard,
        examReadiness,
        learnerMemory: learnerMemoryBundle.learningMemory,
        studyRecommendation,
        studyMission,
        topicErrorInsights,
        examCountdownText: examCountdownLabel(profile.examDate),
        lastTopicLabel,
        studyNowHint,
        resumeJourney: studyResumeJourney,
      }),
    [
      dashboard,
      examReadiness,
      learnerMemoryBundle.learningMemory,
      studyRecommendation,
      studyMission,
      topicErrorInsights,
      profile.examDate,
      lastTopicLabel,
      studyNowHint,
      studyResumeJourney,
    ]
  );

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const prevSessionRef = useRef(null);
  useEffect(() => {
    if (loading) return;
    const prev = prevSessionRef.current;
    prevSessionRef.current = session;
    if (prev && !session) {
      clearAuthTransitionTimers();
      transitionLockRef.current = false;
      setAuthVisible(false);
      setTransitionActive(false);
      setPendingAuthMode(null);
      setPreAuthPhase("landing");
    }
  }, [session, loading, clearAuthTransitionTimers]);

  useEffect(() => {
    const user = session?.user;
    if (!user) return;

    let cancelled = false;

    (async () => {
      await profileRef.current.ensureProfile(user);
      if (cancelled) return;
      await profileRef.current.loadProfile(user.id, user.email);
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const studyContinueOnceRef = useRef(false);
  const skipNextAutoContinueRef = useRef(false);

  useEffect(() => {
    if (mainTab !== "study") {
      studyContinueOnceRef.current = false;
      return;
    }
    if (skipNextAutoContinueRef.current) {
      skipNextAutoContinueRef.current = false;
      studyContinueOnceRef.current = true;
      return;
    }
    if (studyContinueOnceRef.current) return;
    studyContinueOnceRef.current = true;
    void study.continueWhereILeftOff();
  }, [mainTab, study.continueWhereILeftOff]);

  useEffect(() => {
    if (mainTab !== "study") {
      setStudyResumeBannerDismissed(false);
      setStudyFocusMode(false);
      setStudySubTabBoost(null);
    }
  }, [mainTab]);

  const showStudyResumeBanner =
    mainTab === "study" &&
    !studyResumeBannerDismissed &&
    Boolean(dashboard.lastLocal?.topicId) &&
    study.selectedTopic?.id === dashboard.lastLocal?.topicId;

  const handleSelectStudyTopic = useCallback(
    (topic) => {
      setStudyResumeBannerDismissed(true);
      study.handleSelectTopic(topic);
    },
    [study]
  );

  const handleConsumeStudySubTabBoost = useCallback(() => {
    setStudySubTabBoost(null);
  }, []);

  const handleRequestTopicSubTab = useCallback((tab) => {
    if (tab === "chat") setLastStudyUiChat(true);
    else if (tab === "questions" || tab === "explanation") setLastStudyUiChat(false);
    requestAnimationFrame(() => setStudySubTabBoost(tab));
  }, []);

  const handleOpenYaraChatFromQuiz = useCallback((prompt) => {
    setStudyFocusMode(false);
    setLastStudyUiChat(true);
    requestAnimationFrame(() => {
      setStudySubTabBoost("chat");
      queueMicrotask(() => {
        void study.sendTopicChatMessage(prompt);
      });
    });
  }, [study.sendTopicChatMessage]);

  const loadStudyInsights = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId || !mainExamIdForDash) {
      setStudyInsightRows([]);
      setStudyInsightsError("");
      setStudyInsightsLoading(false);
      return;
    }

    setStudyInsightsLoading(true);
    setStudyInsightsError("");
    try {
      const { data: allTopics, error: topicsErr } = await activityApi.fetchAllTopicsForContest(
        supabase,
        mainExamIdForDash
      );
      if (topicsErr) {
        console.error("Erro insights de estudo (catálogo):", topicsErr);
        setStudyInsightsError("Não foi possível carregar o catálogo para as recomendações. Tente atualizar a página.");
        setStudyInsightRows([]);
        return;
      }
      const topicIds =
        Array.isArray(allTopics) && allTopics.length ? allTopics.map((t) => t.id).filter(Boolean) : [];

      if (!topicIds.length) {
        setStudyInsightRows([]);
        return;
      }

      const { data, error: fetchErr } = await activityApi.fetchWrongAttemptsForReview(
        supabase,
        userId,
        topicIds,
        120
      );

      if (fetchErr) {
        console.error("Erro insights de estudo (revisão):", fetchErr);
        setStudyInsightsError("Não foi possível atualizar as recomendações agora.");
        setStudyInsightRows([]);
        return;
      }

      const rows = data ?? [];
      const mapped = rows.map((row) => {
        const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
        const subj = topic?.subjects
          ? Array.isArray(topic.subjects)
            ? topic.subjects[0]
            : topic.subjects
          : null;
        return {
          topic_id: row.topic_id,
          topic_name: topic?.name ?? "Tópico",
          attempted_at: row.attempted_at,
          subject_id: topic?.subject_id ?? null,
          contest_id: subj?.contest_id ?? mainExamIdForDash ?? null,
        };
      });

      setStudyInsightRows(mapped);
    } catch (err) {
      console.error("Erro insights de estudo:", err);
      setStudyInsightsError("Não foi possível atualizar as recomendações agora.");
      setStudyInsightRows([]);
    } finally {
      setStudyInsightsLoading(false);
    }
  }, [session?.user?.id, mainExamIdForDash, supabase]);

  useEffect(() => {
    if (mainTab !== "study" || !session?.user?.id) return;
    void loadStudyInsights();
  }, [mainTab, session?.user?.id, studyInsightsRefreshNonce, loadStudyInsights]);

  const handleStudyNow = useCallback(async () => {
    setStudySubTabBoost(null);
    setMainTab("study");
    if (canContinueStudy) {
      skipNextAutoContinueRef.current = true;
      await study.continueWhereILeftOff();
      setStudyScrollSignal((n) => n + 1);
      return;
    }
    if (dashboard.suggestedStudyRoute) {
      skipNextAutoContinueRef.current = true;
      const ok = await study.openCatalogTopic(dashboard.suggestedStudyRoute);
      if (ok) setStudyScrollSignal((n) => n + 1);
    }
  }, [canContinueStudy, study, dashboard.suggestedStudyRoute]);

  /** Tela inicial do Estudo: abre sugestão, continua sessão ou devolve false para rolar ao catálogo. */
  const welcomeOnStartNow = useCallback(async () => {
    setStudyResumeBannerDismissed(true);
    setStudySubTabBoost(null);
    skipNextAutoContinueRef.current = true;
    if (dashboard.suggestedStudyRoute) {
      const ok = await study.openCatalogTopic(dashboard.suggestedStudyRoute);
      if (ok) setStudyScrollSignal((n) => n + 1);
      return ok;
    }
    if (canContinueStudy) {
      await study.continueWhereILeftOff();
      setStudyScrollSignal((n) => n + 1);
      return true;
    }
    return false;
  }, [canContinueStudy, study, dashboard.suggestedStudyRoute]);

  const handleMissionAction = useCallback(
    async (mission) => {
      if (!mission?.action || mission.done) return;
      skipNextAutoContinueRef.current = true;
      setMainTab("study");
      await study.continueWhereILeftOff();
      if (mission.action === "studyQuiz") {
        setLastStudyUiChat(false);
        requestAnimationFrame(() => setStudySubTabBoost("questions"));
      } else {
        setLastStudyUiChat(false);
        setStudySubTabBoost(null);
      }
      setStudyScrollSignal((n) => n + 1);
    },
    [study]
  );

  const handleCloseStudyReview = useCallback(() => {
    setStudyReviewMode("normal");
    setStudyReviewError("");
    setStudyReviewEmptyHint("");
    setStudyReviewItems([]);
    setStudyReviewLoading(false);
  }, []);

  const handleOpenTopicFromReview = useCallback(
    async (route) => {
      if (!route?.topicId || !route?.subjectId || !route?.contestId) return;
      skipNextAutoContinueRef.current = true;
      setStudyReviewError("");
      const ok = await study.openCatalogTopic(route);
      if (ok) {
        handleCloseStudyReview();
        setLastStudyUiChat(false);
        requestAnimationFrame(() => setStudySubTabBoost("questions"));
        setStudyScrollSignal((n) => n + 1);
      } else {
        setStudyReviewError(
          "Não foi possível abrir este tópico agora. Aguarde o catálogo carregar ou confira se o concurso principal no perfil corresponde ao tópico."
        );
      }
    },
    [study, handleCloseStudyReview]
  );

  const showYaraActionFeedback = useCallback((text, options = {}) => {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return;
    const surface = options.surface === "dashboard" ? "dashboard" : "study";
    if (yaraUiActionHintTimerRef.current) {
      clearTimeout(yaraUiActionHintTimerRef.current);
      yaraUiActionHintTimerRef.current = null;
    }
    const id = ++yaraUiActionHintIdRef.current;
    setYaraUiActionHint({ text: trimmed, id, surface });
    yaraUiActionHintTimerRef.current = setTimeout(() => {
      setYaraUiActionHint((cur) => (cur?.id === id ? null : cur));
      yaraUiActionHintTimerRef.current = null;
    }, 4200);
  }, []);

  const handleReviewErrors = useCallback(async () => {
    const userId = session?.user?.id;
    skipNextAutoContinueRef.current = true;
    setStudyFocusMode(false);
    setMainTab("study");
    setStudyReviewMode("review");
    setStudyReviewLoading(true);
    setStudyReviewError("");
    setStudyReviewEmptyHint("");
    setStudyReviewItems([]);

    if (!userId) {
      setStudyReviewError("Usuário não autenticado.");
      setStudyReviewLoading(false);
      return false;
    }

    try {
      if (!mainExamIdForDash) {
        setStudyReviewEmptyHint(
          "Defina um concurso principal no perfil para listar erros no mesmo escopo do painel (contagem de erros do dashboard)."
        );
        setStudyReviewLoading(false);
        return false;
      }

      const { data: allTopics, error: topicsErr } = await activityApi.fetchAllTopicsForContest(
        supabase,
        mainExamIdForDash
      );
      if (topicsErr) {
        if (import.meta.env.DEV) {
          console.error("[App] handleReviewErrors fetchAllTopicsForContest", topicsErr.message ?? topicsErr);
        }
        setStudyReviewError("Não foi possível carregar os tópicos do concurso. Verifique a conexão e tente de novo.");
        setStudyReviewLoading(false);
        return false;
      }
      const topicIds =
        Array.isArray(allTopics) && allTopics.length ? allTopics.map((t) => t.id).filter(Boolean) : [];

      if (!topicIds.length) {
        setStudyReviewEmptyHint("Não há tópicos cadastrados neste concurso — nada para buscar ainda.");
        setStudyReviewLoading(false);
        return true;
      }

      const { data, error: fetchErr } = await activityApi.fetchWrongAttemptsForReview(supabase, userId, topicIds, 80);

      if (fetchErr) {
        console.error("Erro revisão de erros (tentativas):", fetchErr);
        setStudyReviewError("Não foi possível carregar sua revisão agora.");
        setStudyReviewLoading(false);
        return false;
      }

      const rows = data ?? [];
      const mapped = rows.map((row) => {
        const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
        const subj = topic?.subjects
          ? Array.isArray(topic.subjects)
            ? topic.subjects[0]
            : topic.subjects
          : null;
        const subjectId = topic?.subject_id ?? null;
        const contestFromJoin = subj?.contest_id ?? null;
        return {
          id: row.id,
          attemptedAt: row.attempted_at,
          questionStem: row.question_stem,
          selectedLabel: row.selected_label,
          correctLabel: row.correct_label,
          selectedIndex: row.selected_index,
          correctIndex: row.correct_index,
          topicName: topic?.name ?? "Tópico",
          subjectName: subj?.name ?? "",
          topicId: row.topic_id,
          subjectId,
          contestId: contestFromJoin || mainExamIdForDash || null,
        };
      });

      setStudyReviewItems(mapped);
      return true;
    } catch (err) {
      console.error("Erro ao carregar revisão de erros:", err);
      setStudyReviewError("Não foi possível carregar sua revisão agora.");
      return false;
    } finally {
      setStudyReviewLoading(false);
      void loadStudyInsights();
    }
  }, [session?.user?.id, mainExamIdForDash, supabase, loadStudyInsights]);

  const executeYaraAction = useCallback(
    async (rawAction) => {
      const action = validateYaraAction(rawAction, {
        currentTopicId: study.selectedTopic?.id ?? null,
        currentSubjectId: study.selectedSubject?.id ?? null,
        currentContestId: study.selectedContest?.id ?? null,
        openTopicHints: openTopicHintsForValidation,
      });
      if (!action) return;
      try {
        switch (action.type) {
          case "open_explanation":
            setMainTab("study");
            handleRequestTopicSubTab("explanation");
            showYaraActionFeedback("Yara abriu a conversa neste tópico.");
            break;
          case "open_questions":
            setMainTab("study");
            handleRequestTopicSubTab("questions");
            showYaraActionFeedback("Yara abriu as questões para você");
            break;
          case "focus_chat":
            setMainTab("study");
            handleRequestTopicSubTab("chat");
            setStudyScrollSignal((n) => n + 1);
            showYaraActionFeedback("Yara destacou o chat para você");
            break;
          case "open_review_errors": {
            const ok = await handleReviewErrors();
            if (ok) showYaraActionFeedback("Revisão carregada");
            break;
          }
          case "open_dashboard":
            showYaraActionFeedback("Yara abriu o painel para você", { surface: "dashboard" });
            setMainTab("dashboard");
            break;
          case "open_topic": {
            const p = action.params;
            const topicId = typeof p.topicId === "string" ? p.topicId : "";
            const subjectId = typeof p.subjectId === "string" ? p.subjectId : "";
            const contestId = typeof p.contestId === "string" ? p.contestId : "";
            if (!topicId || !subjectId || !contestId) return;
            skipNextAutoContinueRef.current = true;
            setMainTab("study");
            const ok = await study.openCatalogTopic({ topicId, subjectId, contestId });
            if (ok) {
              showYaraActionFeedback("Tópico aberto");
              setStudyScrollSignal((n) => n + 1);
            }
            break;
          }
          default:
            break;
        }
      } catch {
        /* ação opcional da Yara */
      }
    },
    [
      study,
      openTopicHintsForValidation,
      handleReviewErrors,
      handleRequestTopicSubTab,
      showYaraActionFeedback,
    ]
  );

  useEffect(() => {
    yaraActionRunnerRef.current = executeYaraAction;
    return () => {
      yaraActionRunnerRef.current = null;
    };
  }, [executeYaraAction]);

  const handleRecommendationOpenTopic = useCallback(
    async (rec) => {
      if (!rec?.topic_id || !rec?.subject_id || !rec?.contest_id) return;
      skipNextAutoContinueRef.current = true;
      const ok = await study.openCatalogTopic({
        topicId: rec.topic_id,
        subjectId: rec.subject_id,
        contestId: rec.contest_id,
      });
      if (ok) {
        if (studyMissionRef.current?.topic_id === rec.topic_id) {
          setMissionProgress((p) => ({ ...p, review: true }));
        }
        setLastStudyUiChat(false);
        requestAnimationFrame(() => setStudySubTabBoost("questions"));
        setStudyScrollSignal((n) => n + 1);
      }
    },
    [study]
  );

  const handleRecommendationAskExplanation = useCallback(
    async (rec) => {
      if (!rec?.topic_id || !rec?.subject_id || !rec?.contest_id) return;
      skipNextAutoContinueRef.current = true;
      const ok = await study.openTopicAndAskWhyStruggling(
        {
          topicId: rec.topic_id,
          subjectId: rec.subject_id,
          contestId: rec.contest_id,
        },
        rec.topic_name
      );
      if (ok) {
        if (studyMissionRef.current?.topic_id === rec.topic_id) {
          setMissionProgress((p) => ({ ...p, explain: true }));
        }
        setLastStudyUiChat(true);
        requestAnimationFrame(() => setStudySubTabBoost("chat"));
        setStudyScrollSignal((n) => n + 1);
      }
    },
    [study]
  );

  const handleMissionOpenTopic = useCallback(
    async (mission) => {
      if (!mission?.topic_id || !mission?.subject_id || !mission?.contest_id) return;
      skipNextAutoContinueRef.current = true;
      const ok = await study.openCatalogTopic({
        topicId: mission.topic_id,
        subjectId: mission.subject_id,
        contestId: mission.contest_id,
      });
      if (ok) {
        setMissionProgress((p) => ({ ...p, review: true }));
        setLastStudyUiChat(false);
        requestAnimationFrame(() => setStudySubTabBoost("explanation"));
        setStudyScrollSignal((n) => n + 1);
      }
    },
    [study]
  );

  const handleMissionAskAI = useCallback(
    async (mission) => {
      if (!mission?.topic_id || !mission?.subject_id || !mission?.contest_id) return;
      skipNextAutoContinueRef.current = true;
      const ok = await study.openTopicAndAskWhyStruggling(
        {
          topicId: mission.topic_id,
          subjectId: mission.subject_id,
          contestId: mission.contest_id,
        },
        mission.topic_name
      );
      if (ok) {
        setMissionProgress((p) => ({ ...p, explain: true }));
        setLastStudyUiChat(true);
        requestAnimationFrame(() => setStudySubTabBoost("chat"));
        setStudyScrollSignal((n) => n + 1);
      }
    },
    [study]
  );

  const handleMissionGoQuestions = useCallback(
    async (mission) => {
      if (!mission?.topic_id || !mission?.subject_id || !mission?.contest_id) return;
      skipNextAutoContinueRef.current = true;
      const ok = await study.openCatalogTopic({
        topicId: mission.topic_id,
        subjectId: mission.subject_id,
        contestId: mission.contest_id,
      });
      if (ok) {
        setMissionProgress((p) => ({ ...p, review: true }));
        setLastStudyUiChat(false);
        requestAnimationFrame(() => setStudySubTabBoost("questions"));
        setStudyScrollSignal((n) => n + 1);
      }
    },
    [study]
  );

  const handleDoQuestions = useCallback(async () => {
    skipNextAutoContinueRef.current = true;
    setMainTab("study");
    if (canContinueStudy) {
      await study.continueWhereILeftOff();
    } else if (dashboard.suggestedStudyRoute) {
      await study.openCatalogTopic(dashboard.suggestedStudyRoute);
    }
    setLastStudyUiChat(false);
    requestAnimationFrame(() => setStudySubTabBoost("questions"));
    setStudyScrollSignal((n) => n + 1);
  }, [canContinueStudy, study, dashboard.suggestedStudyRoute]);

  const handleResumeJourneyAction = useCallback(
    async (actionId) => {
      if (actionId === "review_errors") {
        await handleReviewErrors();
        return;
      }
      if (actionId === "do_questions") {
        await handleDoQuestions();
        return;
      }
      if (actionId === "chat") {
        setMainTab("study");
        skipNextAutoContinueRef.current = true;
        if (canContinueStudy) {
          await study.continueWhereILeftOff();
        } else if (dashboard.suggestedStudyRoute) {
          await study.openCatalogTopic(dashboard.suggestedStudyRoute);
        }
        setLastStudyUiChat(true);
        requestAnimationFrame(() => setStudySubTabBoost("chat"));
        setStudyScrollSignal((n) => n + 1);
        return;
      }
      await handleStudyNow();
    },
    [handleReviewErrors, handleDoQuestions, canContinueStudy, study, dashboard.suggestedStudyRoute, handleStudyNow]
  );

  const handleOpenStudyBare = useCallback(() => {
    setMainTab("study");
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !profile.studyMetaReady) return;
    if (!profile.onboardingDone) setShowOnboarding(true);
  }, [session?.user?.id, profile.studyMetaReady, profile.onboardingDone]);

  async function submitAuthAction(action, { mode: authMode, fallbackError }) {
    setSaving(true);
    setError("");
    setMessage("");
    setAuthFeedback(null);
    try {
      await action();
    } catch (err) {
      const feedback = normalizeAuthError(err, authMode);
      setError(feedback.message || fallbackError);
      setAuthFeedback(feedback);
    } finally {
      setSaving(false);
    }
  }

  function handleRegister() {
    return submitAuthAction(async () => {
      if (!profile.name.trim()) {
        throw new Error("Digite seu nome.");
      }
      if (password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      if (password !== passwordConfirm) {
        throw new Error("As senhas não coincidem.");
      }

      const { data, error: signUpError } = await authApi.signUp(supabase, {
        email: profile.email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { name: profile.name.trim() },
        },
      });

      if (signUpError) throw signUpError;

      const user = data.user;
      const hasSession = !!data.session;
      const signupFeedback = describeSignupResult(data);

      if (hasSession && user) {
        const ensured = await profile.ensureProfile(user);
        if (ensured?.error) {
          setAuthFeedback({
            kind: "warning",
            title: "Conta criada, mas o perfil inicial não ficou pronto.",
            message:
              "Seu acesso foi aberto, porém houve um erro ao preparar o perfil no banco. Você pode tentar continuar e salvar de novo.",
            detail: ensured.error.message || "",
          });
          setError(ensured.error.message || "");
        } else {
          setAuthFeedback(signupFeedback);
          setMessage(signupFeedback.message);
        }
      } else {
        setAuthFeedback(signupFeedback);
        setMessage(signupFeedback.message);
        setMode("login");
      }

      setPassword("");
      setPasswordConfirm("");
    }, { mode: "signup", fallbackError: "Erro ao criar conta." });
  }

  function handleLogin() {
    return submitAuthAction(async () => {
      const { error: signInError } = await authApi.signInWithPassword(
        supabase,
        profile.email,
        password
      );
      if (signInError) throw signInError;

      setMessage("Login realizado com sucesso.");
      setAuthFeedback({
        kind: "success",
        title: "Você voltou para o Aprova+.",
        message: "A Yara já pode retomar seu estudo de onde parou.",
        detail: "",
      });
      setPassword("");
      setPasswordConfirm("");
    }, { mode: "login", fallbackError: "Erro ao entrar." });
  }

  async function handleSaveProfile() {
    if (!session?.user) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await profile.saveProfile(session.user);
      setMessage("Perfil salvo com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    const { error: signOutError } = await authApi.signOut(supabase);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setMessage("Você saiu da conta.");
    setAuthFeedback(null);
    setShowOnboarding(false);
    setPreAuthPhase("landing");
    setMainTab("dashboard");
    setStudyFocusMode(false);
    setLastStudyUiChat(false);
    setStudySubTabBoost(null);
    setNavHydrated(false);
    openChatAfterHydrateRef.current = false;
    study.resetAll();
  }

  async function handleOnboardingFinished(payload) {
    if (!session?.user) return;
    await profile.completeOnboarding(session.user, payload);
    const { error: metadataError } = await authApi.updateUserMetadata(supabase, {
      yara_profile: {
        contestId: payload.mainExamId ?? null,
        contestLabel: payload.contestLabel ?? "",
        examDate: payload.examDate?.trim() || "",
        hoursPerDay: payload.hoursPerDay ?? null,
        currentLevel: payload.currentLevel ?? "",
        biggestDifficulties: Array.isArray(payload.biggestDifficulties)
          ? payload.biggestDifficulties
          : [],
        explanationPreference: payload.explanationPreference ?? "",
        preferredStudyMove: payload.preferredStudyMove ?? "",
        initialFocus: payload.initialFocus ?? "",
        updatedAt: new Date().toISOString(),
      },
    });
    await study.reloadContests();
    setShowOnboarding(false);
    if (metadataError) {
      setMessage("Plano base salvo. Algumas preferências extras da Yara não entraram agora, mas você já pode estudar.");
      return;
    }
    setMessage("Preferências salvas. Bom estudo!");
  }

  const dashboardRefreshRef = useRef(dashboard.refresh);
  dashboardRefreshRef.current = dashboard.refresh;

  useEffect(() => {
    if (mainTab === "dashboard") dashboardRefreshRef.current();
  }, [mainTab]);

  const studyApi = useMemo(
    () => ({
      createUserContest: study.createUserContest,
      addSubjectToContest: study.addSubjectToContest,
      addTopicToSubject: study.addTopicToSubject,
      reloadContests: study.reloadContests,
      fetchContestsCatalog: study.fetchContestsCatalog,
      searchContests: study.searchContests,
      getSuggestedContests: study.getSuggestedContests,
      fetchPublicContestCatalogTree: study.fetchPublicContestCatalogTree,
      ensureRuntimeContestFromCatalog: study.ensureRuntimeContestFromCatalog,
    }),
    [
      study.createUserContest,
      study.addSubjectToContest,
      study.addTopicToSubject,
      study.reloadContests,
      study.fetchContestsCatalog,
      study.searchContests,
      study.getSuggestedContests,
      study.fetchPublicContestCatalogTree,
      study.ensureRuntimeContestFromCatalog,
    ]
  );

  persistExtrasRef.current = {
    mainTab,
    studyFocusMode: mainTab === "study" ? studyFocusMode : false,
    lastStudyUiChat: mainTab === "study" ? lastStudyUiChat : false,
  };

  const workspaceTabHint = useMemo(() => {
    if (!session?.user?.id || !study.selectedTopic?.id) return "explanation";
    const s = readLastStudySession(session.user.id);
    if (!s || s.topicId !== study.selectedTopic.id) return "explanation";
    return s.activeStudyTab === "questions" ? "questions" : "explanation";
  }, [session?.user?.id, study.selectedTopic?.id, navHydrated]);

  const handleStudyWorkspaceTabActivated = useCallback(() => {
    setLastStudyUiChat(false);
  }, []);

  const showShellLoading = loading || (Boolean(session?.user?.id) && !navHydrated);
  const isAdminRoute = pathname === "/admin/contests";

  if (showShellLoading) {
    return (
      <>
        <OrganicScene />
        <main className="aprova-site-shell" style={{ ...styles.centerScreen, background: "transparent" }}>
          <LoadingScreen embedded />
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <OrganicScene />
        <main className="aprova-site-shell">
          {preAuthPhase === "landing" ? (
            <>
              <LandingPage
                warpActive={transitionActive}
                onStartRegister={() => startAuthTransition("register")}
                onStartLogin={() => startAuthTransition("login")}
              />
              <OrganicSectionsShowcase />
            </>
          ) : null}
          {preAuthPhase === "auth" ? (
            <div className={`aprova-auth-screen ${authVisible ? "is-visible" : ""}`}>
              <AuthScreen
                mode={mode}
                setMode={setMode}
                name={profile.name}
                setName={profile.setName}
                email={profile.email}
                setEmail={profile.setEmail}
                password={password}
                setPassword={setPassword}
                passwordConfirm={passwordConfirm}
                setPasswordConfirm={setPasswordConfirm}
                goal={profile.goal}
                setGoal={profile.setGoal}
                hours={profile.hours}
                setHours={profile.setHours}
                error={error}
                message={message}
                authFeedback={authFeedback}
                saving={saving}
                onSubmit={mode === "login" ? handleLogin : handleRegister}
                onBackToLanding={handleBackToLanding}
              />
            </div>
          ) : null}
        </main>
        <CosmicTransition active={transitionActive} mode={pendingAuthMode} />
      </>
    );
  }

  return (
    <div
      className="aprova-app-shell"
      style={{
        fontFamily: styles.page.fontFamily,
        color: "#f4f4f5",
      }}
    >
      <div className="aprova-app-shell-bg" aria-hidden="true">
        <div className="aprova-app-shell-orb aprova-app-shell-orb-a" />
        <div className="aprova-app-shell-orb aprova-app-shell-orb-b" />
        <div className="aprova-app-shell-orb aprova-app-shell-orb-c" />
        <div className="aprova-app-shell-grid" />
        <div className="aprova-app-shell-noise" />
        <div className="aprova-app-shell-noise-fine" />
      </div>
      <OrganicScene />
      <OnboardingModal
        open={showOnboarding}
        user={session.user}
        contests={study.contests}
        studyApi={studyApi}
        onFinished={handleOnboardingFinished}
      />

      <DashboardHeader
        onLogout={handleLogout}
        studyFocusMode={studyFocusMode && mainTab === "study"}
        onExitStudyFocus={() => setStudyFocusMode(false)}
      >
        {isAdminRoute ? (
          <div className="aprova-admin-nav">
            <button type="button" className="aprova-admin-nav-link" onClick={() => navigateToPath("/")}>
              Voltar ao produto
            </button>
          </div>
        ) : (
          <AppMainNav activeTab={mainTab} onTabChange={setMainTab} />
        )}
      </DashboardHeader>

      <main className="aprova-app-main">
        {isAdminRoute ? (
          <div className="aprova-main-tab-content aprova-view-stage">
            <AdminContestsPage supabase={supabase} session={session} onBackToApp={() => navigateToPath("/")} />
          </div>
        ) : null}

        {!isAdminRoute && mainTab === "dashboard" ? (
          <div
            key="view-dashboard"
            style={styles.mainTabContent}
            className="aprova-main-tab-content aprova-view-stage"
          >
            {yaraUiActionHint?.surface === "dashboard" && yaraUiActionHint.text?.trim() ? (
              <div
                key={yaraUiActionHint.id}
                className="aprova-yara-action-feedback aprova-yara-action-feedback--dashboard"
                role="status"
                aria-live="polite"
              >
                <span className="aprova-yara-action-feedback__glow" aria-hidden />
                <span className="aprova-yara-action-feedback__label">Yara</span>
                <p className="aprova-yara-action-feedback__text">{yaraUiActionHint.text.trim()}</p>
              </div>
            ) : null}
            <DashboardStudyHub
              displayName={profile.name || session.user.email}
              loading={dashboard.loading}
              examDate={profile.examDate}
              examCountdownText={examCountdownText}
              mainExamName={mainExamName}
              studyNowHint={studyNowHint}
              onStudyNow={handleStudyNow}
              lastTopicLabel={lastTopicLabel}
              continueProgressLine={dashboard.continueProgressLine}
              onContinueStudy={handleOpenStudyBare}
              onReviewErrors={handleReviewErrors}
              onDoQuestions={handleDoQuestions}
              topicsStudied={dashboard.topicsStudiedMain}
              topicsTotal={dashboard.topicsTotal}
              questionSends={dashboard.questionSends}
              quizAttempts={dashboard.quizAttempts}
              quizCorrect={dashboard.quizCorrect}
              quizWrong={dashboard.quizWrong}
              studyDays={dashboard.studyDays}
              studyStreak={dashboard.studyStreak}
              overallProgressPct={dashboard.overallProgressPct}
              subjectProgress={dashboard.subjectProgress}
              adaptiveFocusHint={dashboard.adaptiveFocusHint}
              dailyMissions={dashboard.dailyMissions}
              evolutionLines={dashboard.evolutionLines}
              suggestion={dashboard.suggestion}
              planLines={dashboard.planLines}
              recentRows={dashboard.recentRows}
              commandCenter={dashboardCommandCenter}
              resumeJourney={studyResumeJourney}
              onOpenStudyTab={handleOpenStudyBare}
              onMissionAction={handleMissionAction}
              onResumeAction={handleResumeJourneyAction}
            />
          </div>
        ) : null}

        <div
          className={mainTab === "study" ? "aprova-main-tab-content" : undefined}
          style={{
            ...styles.studyTabMain,
            display: !isAdminRoute && mainTab === "study" ? "block" : "none",
            ...(mainTab === "study" ? styles.mainTabContent : {}),
          }}
          aria-hidden={isAdminRoute || mainTab !== "study"}
        >
          {studyFocusMode && mainTab === "study" ? (
            <div
              aria-hidden
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                zIndex: 30,
                pointerEvents: "none",
              }}
            />
          ) : null}
          <div style={{ position: "relative", zIndex: studyFocusMode && mainTab === "study" ? 31 : "auto" }}>
            <StudyAreaPanel
            mainExamId={mainExamIdForDash}
            pinnedContestId={pinnedContestId}
            onboardingDone={profile.onboardingDone}
            resumeBannerVisible={showStudyResumeBanner && !studyFocusMode}
            onDismissResumeBanner={() => setStudyResumeBannerDismissed(true)}
            resumeJourney={studyResumeJourney}
            onResumeJourneyAction={handleResumeJourneyAction}
            studyFocusMode={studyFocusMode}
            onRequestStudyFocus={() => setStudyFocusMode(true)}
            scrollIntoContentSignal={studyScrollSignal}
            externalSubTab={studySubTabBoost}
            onExternalSubTabConsumed={handleConsumeStudySubTabBoost}
            workspaceTabHint={workspaceTabHint}
            onStudyWorkspaceTabActivated={handleStudyWorkspaceTabActivated}
            catalogError={study.catalogError}
            topicFlowError={study.topicFlowError}
            catalogLoading={study.catalogLoading}
            explanationLoading={study.explanationLoading}
            chatSending={study.chatSending}
            chatHistoryClearing={study.chatHistoryClearing}
            onStartNewTopicChat={study.startNewTopicChat}
            contests={study.contests}
            subjectsList={study.subjectsList}
            topicsList={study.topicsList}
            selectedContest={study.selectedContest}
            selectedSubject={study.selectedSubject}
            selectedTopic={study.selectedTopic}
            topicExplanation={study.topicExplanation}
            topicChatMessages={study.topicChatMessages}
            topicQuestions={study.topicQuestions}
            questionsLoading={study.questionsLoading}
            questionsError={study.questionsError}
            questionPicks={study.questionPicks}
            questionRevealed={study.questionRevealed}
            chatInput={study.chatInput}
            setChatInput={study.setChatInput}
            onPickContest={study.handlePickContest}
            onPickSubject={study.handlePickSubject}
            onSelectTopic={handleSelectStudyTopic}
            onSendChat={() => study.sendTopicChatMessage()}
            onSendChatPrompt={(text) => study.sendTopicChatMessage(text)}
            onGenerateQuestions={() => study.generateTopicQuestions()}
            onResetQuestions={study.resetTopicQuestions}
            onQuestionPick={study.setQuestionPick}
            onQuestionReveal={study.handleQuestionReveal}
            quizMistakeByKey={study.quizMistakeByKey}
            onRequestSimplerQuizMistake={study.requestSimplerQuizMistake}
            onRequestTopicSubTab={handleRequestTopicSubTab}
            onOpenYaraChatFromQuiz={handleOpenYaraChatFromQuiz}
            recoveryTrainingMeta={study.recoveryTrainingMeta}
            recoveryFeedback={study.recoveryFeedback}
            onStartRecoveryTraining={study.startRecoveryTraining}
            adaptiveSimuladoMeta={study.adaptiveSimuladoMeta}
            adaptiveSimuladoResult={study.adaptiveSimuladoResult}
            onStartAdaptiveSimulado={study.startAdaptiveSimulado}
            onStudySubTabChange={study.onStudySubTabChange}
            examBannerText={examCountdownText}
            chatUserDisplayName={chatUserDisplayName}
            mainExamDisplayName={mainExamName}
            examSummaryLine={profileExamSummary}
            weeklyMetaLine={weeklyMetaLine}
            overallProgressPct={dashboard.overallProgressPct}
            subjectProgress={dashboard.subjectProgress}
            adaptiveFocusHint={dashboard.adaptiveFocusHint}
            suggestedNextTopicName={dashboard.suggestedNextTopicName}
            suggestedNextSubjectName={dashboard.suggestedNextSubjectName}
            planProgressAligned={planProgressAligned}
            canContinueStudy={canContinueStudy}
            welcomeOnStartNow={welcomeOnStartNow}
            suggestedTopicId={dashboard.suggestedStudyRoute?.topicId ?? null}
            dailyMissions={dashboard.dailyMissions}
            planLines={dashboard.planLines}
            quizWrong={dashboard.quizWrong}
            quizCorrect={dashboard.quizCorrect}
            quizAttempts={dashboard.quizAttempts}
            studyStreak={dashboard.studyStreak}
            topicsStudiedMain={dashboard.topicsStudiedMain}
            topicsTotal={dashboard.topicsTotal}
            onReviewErrors={handleReviewErrors}
            onDoQuestions={handleDoQuestions}
            onMissionAction={handleMissionAction}
            hoursPerDay={profile.hours}
            studyReviewMode={studyReviewMode}
            studyReviewItems={studyReviewItems}
            studyReviewLoading={studyReviewLoading}
            studyReviewError={studyReviewError}
            studyReviewEmptyHint={studyReviewEmptyHint}
            onCloseStudyReview={handleCloseStudyReview}
            onOpenReviewTopic={handleOpenTopicFromReview}
            studyRecommendation={studyRecommendation}
            studyInsightsLoading={studyInsightsLoading}
            studyInsightsError={studyInsightsError}
            studyInsightTopicCount={topicErrorInsights.length}
            hasMainExamForInsights={Boolean(mainExamIdForDash)}
            onRecommendationOpenTopic={handleRecommendationOpenTopic}
            onRecommendationAskExplanation={handleRecommendationAskExplanation}
            studyMission={studyMission}
            missionProgress={missionProgress}
            onMissionOpenTopic={handleMissionOpenTopic}
            onMissionAskAI={handleMissionAskAI}
            onMissionGoQuestions={handleMissionGoQuestions}
            yaraActionFeedback={
              yaraUiActionHint?.surface === "study"
                ? { text: yaraUiActionHint.text, id: yaraUiActionHint.id }
                : null
            }
            yaraMiniSessionUi={study.yaraMiniSessionUi}
            examReadiness={examReadiness}
          />
          </div>
        </div>

        {!isAdminRoute && mainTab === "profile" ? (
          <div
            key="view-profile"
            style={{ ...styles.profileTabWrap, ...styles.mainTabContent }}
            className="aprova-main-tab-content aprova-view-stage"
          >
            <ProfileOrganicPanel
              name={profile.name}
              setName={profile.setName}
              goal={profile.goal}
              setGoal={profile.setGoal}
              hours={profile.hours}
              setHours={profile.setHours}
              examDate={profile.examDate}
              setExamDate={profile.setExamDate}
              contests={study.contests}
              mainExamId={profile.mainExamId}
              setMainExamId={profile.setMainExamId}
              mainExamLabel={mainExamName || ""}
              examSummaryLine={profileExamSummary}
              error={error}
              message={message}
              saving={saving}
              onSaveProfile={handleSaveProfile}
              topicsStudied={dashboard.topicsStudiedMain}
              topicsTotal={dashboard.topicsTotal}
              quizAttempts={dashboard.quizAttempts}
              nextStepHint={
                lastTopicLabel
                  ? `Retomar “${lastTopicLabel.length > 36 ? `${lastTopicLabel.slice(0, 34)}…` : lastTopicLabel}”`
                  : dashboard.continueProgressLine || undefined
              }
              subscription={subscription.subscription}
              subscriptionAccess={subscription.access}
              subscriptionLoading={subscription.loading}
              checkoutBusy={subscription.checkoutBusy}
              portalBusy={subscription.portalBusy}
              subscriptionError={subscription.error}
              onStartCheckout={subscription.startCheckout}
              onManageSubscription={subscription.openBillingPortal}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
