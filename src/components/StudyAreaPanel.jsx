import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDown, ListOrdered, MessageSquarePlus, Send, Sparkles } from "lucide-react";
import { styles } from "../styles/appStyles.js";
import { TopicQuizSection } from "./TopicQuizSection.jsx";
import { TopicExplanationChunk, TopicExplanationContent } from "./TopicExplanationContent.jsx";
import { shouldShowContestColumn } from "../utils/studyContestUi.js";
import { ChatMessageBubble, YARA_NAME, YARA_ROLE_LABEL } from "./ChatMessageBubble.jsx";
import { ReviewErrorsScreen } from "./ReviewErrorsScreen.jsx";
import { StudyWelcomeShell } from "./StudyWelcomeShell.jsx";
import { PremiumFeatureCard } from "./PremiumFeatureCard.jsx";
import { UpgradeInlineNotice } from "./UpgradeInlineNotice.jsx";
import { UsageLimitNotice } from "./UsageLimitNotice.jsx";
import {
  isMissionFullyDone,
  isMissionStepDone,
  MISSION_PRACTICE_TARGET,
} from "../utils/studyMission.js";
import { useStudyChatScroll } from "../hooks/useStudyChatScroll.js";
import { useProgressiveExplanationReveal } from "../hooks/useProgressiveExplanationReveal.js";
import {
  buildProgressiveExplanationParts,
  progressivePartsSignature,
} from "../utils/progressiveExplanationParts.js";
import { ExamReadinessStrip } from "./ExamReadinessStrip.jsx";

/** Card leve: mini-sessão sugerida pela Yara (2–3 passos; alinhado ao tema lilás / dark premium). */
function YaraMiniSessionCard({ session, subdued }) {
  if (!session?.steps?.length) return null;
  return (
    <aside
      className={`aprova-yara-mini-session${subdued ? " aprova-yara-mini-session--subdued" : ""}`}
      aria-label="Sequência de estudo sugerida pela Yara"
    >
      <span className="aprova-yara-mini-session__glow" aria-hidden />
      <div className="aprova-yara-mini-session__head">
        <span className="aprova-yara-mini-session__icon" aria-hidden>
          <ListOrdered size={18} strokeWidth={2.2} />
        </span>
        <div className="aprova-yara-mini-session__head-copy">
          <p className="aprova-yara-mini-session__kicker">Yara</p>
          <p className="aprova-yara-mini-session__title">{session.title}</p>
        </div>
      </div>
      <ol className="aprova-yara-mini-session__steps" role="list">
        {session.steps.map((s, i) => (
          <li
            key={`${session.id}-${s.type}-${i}`}
            className={`aprova-yara-mini-session__step aprova-yara-mini-session__step--${s.status}`}
            aria-current={s.status === "current" ? "step" : undefined}
          >
            <span className="aprova-yara-mini-session__mark" aria-hidden />
            <span className="aprova-yara-mini-session__step-label">{s.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** Missão + recomendação + atalhos — coluna contextual com tópico aberto (mesma linguagem dos cards superiores). */
function StudyTopicSidebar({
  studyInsightsError,
  hasMainExamForInsights,
  studyInsightsLoading,
  studyRecommendation,
  studyInsightTopicCount,
  onRecommendationOpenTopic,
  onRecommendationAskExplanation,
  studyMission,
  missionProgress,
  onMissionOpenTopic,
  onMissionGoQuestions,
  onMissionAskAI,
  onReviewErrors,
  onDoQuestions,
  examReadiness = null,
  featureAccess = null,
  onUpgradeToPro,
}) {
  const premiumInsightsLocked = Boolean(featureAccess && !featureAccess.canUsePremiumInsights);
  const premiumCopy = featureAccess?.getUpgradeCopy?.("premiumInsights");

  return (
    <div className="aprova-study-topic-side-inner">
      <div className="aprova-study-topic-side-block" aria-live="polite">
        <span className="aprova-study-topic-side-kicker">Yara · contexto</span>
        {premiumInsightsLocked && premiumCopy ? (
          <UpgradeInlineNotice
            title={premiumCopy.title}
            description={premiumCopy.description}
            ctaLabel={premiumCopy.cta}
            onUpgrade={onUpgradeToPro}
          />
        ) : null}
        {examReadiness && hasMainExamForInsights && !studyInsightsLoading && !premiumInsightsLocked ? (
          <ExamReadinessStrip readiness={examReadiness} compact />
        ) : null}
        {studyInsightsError ? (
          <p className="aprova-study-topic-side-text aprova-study-topic-side-text--error">{studyInsightsError}</p>
        ) : null}
        {!studyInsightsError && !hasMainExamForInsights ? (
          <p className="aprova-study-topic-side-text">
            Defina o <strong>concurso principal</strong> no perfil para priorizar erros neste plano.
          </p>
        ) : null}
        {!studyInsightsError && hasMainExamForInsights && studyInsightsLoading ? (
          <p className="aprova-study-topic-side-text aprova-study-topic-side-text--muted">
            Atualizando análise de erros…
          </p>
        ) : null}
        {!studyInsightsError &&
        hasMainExamForInsights &&
        !studyInsightsLoading &&
        studyRecommendation &&
        !premiumInsightsLocked ? (
          <>
            <p className="aprova-study-topic-side-reco">{studyRecommendation.message}</p>
            {studyInsightTopicCount > 0 ? (
              <p className="aprova-study-topic-side-meta">
                {studyInsightTopicCount} tópico{studyInsightTopicCount !== 1 ? "s" : ""} com erro
              </p>
            ) : null}
            {studyRecommendation.topic_id &&
            studyRecommendation.subject_id &&
            studyRecommendation.contest_id ? (
              <div className="aprova-study-topic-side-btn-row">
                <button
                  type="button"
                  className="aprova-study-topic-side-btn aprova-study-topic-side-btn--primary"
                  onClick={() => onRecommendationOpenTopic?.(studyRecommendation)}
                >
                  Revisar agora
                </button>
                <button
                  type="button"
                  className="aprova-study-topic-side-btn"
                  onClick={() => onRecommendationAskExplanation?.(studyRecommendation)}
                >
                  Conversa
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        {!studyInsightsError &&
        hasMainExamForInsights &&
        !studyInsightsLoading &&
        !studyRecommendation ? (
          <p className="aprova-study-topic-side-text aprova-study-topic-side-text--muted">
            Sem erros registrados no concurso principal — ótimo sinal.
          </p>
        ) : null}
      </div>

      {studyMission && hasMainExamForInsights && !studyInsightsLoading && !premiumInsightsLocked ? (
        <div className="aprova-study-topic-side-block aprova-study-topic-side-block--mission">
          <span className="aprova-study-topic-side-kicker">Missão do dia</span>
          <p className="aprova-study-topic-side-mission-title">Foco: {studyMission.topic_name}</p>
          <ul className="aprova-study-topic-side-mission-steps" role="list">
            {studyMission.steps.map((step) => {
              const done = isMissionStepDone(missionProgress, step);
              const practiceCount =
                step.type === "practice"
                  ? Math.min(
                      step.target ?? MISSION_PRACTICE_TARGET,
                      typeof missionProgress.practice === "number" ? missionProgress.practice : 0
                    )
                  : 0;
              const practiceTarget = step.target ?? MISSION_PRACTICE_TARGET;
              return (
                <li key={step.id} className={`aprova-study-topic-side-mission-step${done ? " is-done" : ""}`}>
                  <span aria-hidden>{done ? "✓" : "○"}</span>
                  <span>
                    {step.label}
                    {step.type === "practice" ? (
                      <span className="aprova-study-topic-side-mission-sub">
                        {" "}
                        ({practiceCount}/{practiceTarget})
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {isMissionFullyDone(studyMission, missionProgress) ? (
            <p className="aprova-study-topic-side-mission-done">Missão concluída neste ciclo.</p>
          ) : null}
          <div className="aprova-study-topic-side-btn-row aprova-study-topic-side-btn-row--wrap">
            <button
              type="button"
              className="aprova-study-topic-side-btn aprova-study-topic-side-btn--primary"
              onClick={() => onMissionOpenTopic?.(studyMission)}
            >
              Começar
            </button>
            <button
              type="button"
              className="aprova-study-topic-side-btn"
              onClick={() => onMissionGoQuestions?.(studyMission)}
            >
              Questões
            </button>
            <button
              type="button"
              className="aprova-study-topic-side-btn"
              onClick={() => onMissionAskAI?.(studyMission)}
            >
              Yara
            </button>
          </div>
        </div>
      ) : null}

      <div className="aprova-study-topic-side-block">
        <span className="aprova-study-topic-side-kicker">Atalhos</span>
        <div className="aprova-study-topic-side-btn-row aprova-study-topic-side-btn-row--stack">
          <button type="button" className="aprova-study-topic-side-btn" onClick={onReviewErrors}>
            Revisar erros
          </button>
          <button type="button" className="aprova-study-topic-side-btn" onClick={onDoQuestions}>
            Ir às questões
          </button>
        </div>
      </div>
    </div>
  );
}

/** Workspace do tópico: abas Conversa (leitura inicial + chat unificados) | Questões; coluna lateral de contexto quando houver. */
function TopicStudyWorkspace({
  selectedTopic,
  selectedContest,
  selectedSubject,
  examBannerText,
  topicFlowError,
  explanationLoading,
  topicExplanation,
  topicQuestions,
  questionsLoading,
  questionsError,
  questionPicks,
  questionRevealed,
  topicChatMessages,
  chatInput,
  setChatInput,
  chatSending,
  chatHistoryClearing = false,
  onStartNewTopicChat,
  onSendChat,
  onSendChatPrompt,
  onGenerateQuestions,
  onResetQuestions,
  onQuestionPick,
  onQuestionReveal,
  onStudySubTabChange,
  quizMistakeByKey = {},
  onRequestSimplerQuizMistake,
  onRequestTopicSubTab,
  onOpenYaraChatFromQuiz,
  recoveryTrainingMeta = null,
  recoveryFeedback = null,
  onStartRecoveryTraining,
  simuladoMeta = null,
  simuladoResult = null,
  studyContentAnchorRef,
  scrollIntoContentSignal,
  externalSubTab,
  onExternalSubTabConsumed,
  workspaceTabHint = "explanation",
  onStudyWorkspaceTabActivated,
  hideExamBanner,
  hideTopicBadge,
  compactHeader,
  workspaceSplitDisabled = false,
  chatUserDisplayName = "Você",
  contextAside = null,
  yaraActionFeedback = null,
  yaraMiniSessionUi = null,
  featureAccess = null,
  usageQuota = null,
  onUpgradeToPro,
}) {
  const [studyViewTab, setStudyViewTab] = useState(() =>
    workspaceTabHint === "questions" ? "questions" : "explanation"
  );
  const chatBusy = chatSending || chatHistoryClearing;
  const chatLocked = Boolean(featureAccess && !featureAccess.canUseYaraChat);
  const chatUpgradeCopy = featureAccess?.getUpgradeCopy?.("yaraChat");
  const remainingChat = featureAccess?.getRemainingChatQuota?.();
  const focusStreamlined = Boolean(workspaceSplitDisabled);
  const resolvedStudyViewTab = studyViewTab === "chat" ? "explanation" : studyViewTab;

  const activeModeLabel = resolvedStudyViewTab === "explanation" ? "Conversa" : "Questões";

  const threadPrefaceActive = useMemo(
    () => explanationLoading || Boolean((topicExplanation ?? "").trim()),
    [explanationLoading, topicExplanation]
  );

  const explanationParts = useMemo(() => {
    if (explanationLoading) return [];
    return buildProgressiveExplanationParts(topicExplanation);
  }, [explanationLoading, topicExplanation]);

  const explanationPartsSignature = useMemo(
    () => progressivePartsSignature(explanationParts),
    [explanationParts]
  );

  const { visibleCount: explanationVisibleCount } = useProgressiveExplanationReveal({
    topicId: selectedTopic?.id,
    parts: explanationParts,
    explanationLoading,
    partsSignature: explanationPartsSignature,
    topicChatMessages,
  });

  const chatScrollRef = useRef(null);
  const {
    onScrollContainerScroll,
    showJumpToBottom,
    scrollToBottomSmooth,
    scrollToBottomInstant,
  } = useStudyChatScroll({
    scrollRef: chatScrollRef,
    topicId: selectedTopic?.id,
    messages: topicChatMessages,
    chatSending,
    chatHistoryClearing,
    threadPrefaceActive,
    progressiveAssistTicks: explanationLoading ? 0 : explanationVisibleCount,
    explanationLoading,
  });

  useEffect(() => {
    onStudySubTabChange?.(resolvedStudyViewTab);
  }, [resolvedStudyViewTab, onStudySubTabChange]);

  useEffect(() => {
    if (!externalSubTab || !selectedTopic) return;
    queueMicrotask(() => {
      if (externalSubTab === "chat") {
        setStudyViewTab("explanation");
        onStudyWorkspaceTabActivated?.();
        document.getElementById("aprova-study-topic-chat-anchor")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToBottomInstant());
        });
      } else if (externalSubTab === "questions") {
        setStudyViewTab("questions");
        onStudyWorkspaceTabActivated?.();
      } else {
        setStudyViewTab("explanation");
        onStudyWorkspaceTabActivated?.();
      }
      onExternalSubTabConsumed?.();
    });
  }, [
    externalSubTab,
    selectedTopic,
    onExternalSubTabConsumed,
    onStudyWorkspaceTabActivated,
    scrollToBottomInstant,
  ]);

  useEffect(() => {
    if (!scrollIntoContentSignal) return;
    const id = requestAnimationFrame(() => {
      studyContentAnchorRef?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [scrollIntoContentSignal, studyContentAnchorRef]);

  const tabDefs = [
    { id: "explanation", label: "Conversa" },
    { id: "questions", label: "Questões" },
  ];

  const questionsPanelWide = (
    <div
      key="questions"
      className="aprova-study-tab-panel aprova-study-topic-panel--quiz-host"
      role="tabpanel"
    >
      <TopicQuizSection
        questions={topicQuestions}
        loading={questionsLoading}
        error={questionsError}
        disabled={!selectedTopic?.id || explanationLoading}
        picks={questionPicks}
        revealed={questionRevealed}
        onPick={onQuestionPick}
        onReveal={onQuestionReveal}
        onGenerate={onGenerateQuestions}
        onReset={onResetQuestions}
        inTopicShell
        quizMistakeByKey={quizMistakeByKey}
        onRequestSimplerQuizMistake={onRequestSimplerQuizMistake}
        onQuizReviewTheory={() => onRequestTopicSubTab?.("explanation")}
        onQuizOpenYaraChat={onOpenYaraChatFromQuiz}
        recoveryTrainingMeta={recoveryTrainingMeta}
        recoveryFeedback={recoveryFeedback}
        onStartRecoveryTraining={onStartRecoveryTraining}
        simuladoMeta={simuladoMeta}
        simuladoResult={simuladoResult}
        featureAccess={featureAccess}
        usageQuota={usageQuota?.usage ?? null}
        onUpgradeToPro={onUpgradeToPro}
      />
    </div>
  );

  const chatYaraBlock = (
    <>
      <header className="aprova-chat-header aprova-chat-header--topic-yara">
        <div className="aprova-chat-header-main">
          <div className="aprova-chat-header-avatar aprova-chat-header-avatar--topic" aria-hidden="true">
            <Sparkles size={22} strokeWidth={2.2} />
          </div>
          <div className="aprova-chat-header-copy">
            <p className="aprova-chat-header-eyebrow">
              {YARA_NAME} · assistente de estudo
            </p>
            <h2 className="aprova-chat-header-name">
              <span className="aprova-chat-header-name-accent">{YARA_NAME}</span>
            </h2>
            <p className="aprova-chat-header-role">{YARA_ROLE_LABEL}</p>
          </div>
        </div>
        <div className="aprova-chat-header-aside aprova-chat-header-aside--topic-actions">
          <span className="aprova-chat-header-status">Com você neste tópico</span>
          <button
            type="button"
            className="aprova-chat-new-thread-btn"
            onClick={() => onStartNewTopicChat?.()}
            disabled={chatBusy}
            aria-label="Apagar conversa e começar uma nova neste tópico"
          >
            <MessageSquarePlus size={17} strokeWidth={2.2} aria-hidden />
            <span>{chatHistoryClearing ? "Limpando…" : "Nova conversa"}</span>
          </button>
        </div>
      </header>
      <p className="aprova-chat-header-sub aprova-chat-header-sub--topic">
        A leitura inicial chega em mensagens curtas da {YARA_NAME} — você pode responder a qualquer momento. Use os
        atalhos ou escreva para simplificar, exemplificar ou aprofundar. O histórico fica salvo;{" "}
        <strong className="aprova-chat-header-sub-strong">Nova conversa</strong> apaga só as mensagens trocadas, sem
        perder a explicação base.
      </p>
    </>
  );

  const chatHelperAside = <p className="aprova-chat-helper-label aprova-chat-helper-label--topic">Atalhos da Yara</p>;

  const chatQuickActions = (
    <div className="aprova-chat-quick-actions aprova-chat-quick-actions--topic">
      <button
        type="button"
        className="aprova-btn-interactive"
        style={{
          ...styles.quickActionButton,
          ...(chatBusy || chatLocked ? styles.quickActionButtonDisabled : {}),
        }}
        disabled={chatBusy || chatLocked}
        onClick={() =>
          onSendChatPrompt(
            "Explique este conteúdo de forma mais clara e didática, aprofundando os pontos principais."
          )
        }
      >
        Explicar melhor
      </button>
      <button
        type="button"
        className="aprova-btn-interactive"
        style={{
          ...styles.quickActionButton,
          ...(chatBusy || chatLocked ? styles.quickActionButtonDisabled : {}),
        }}
        disabled={chatBusy || chatLocked}
        onClick={() => onSendChatPrompt("Dê um exemplo prático e simples sobre este conteúdo.")}
      >
        Dar exemplo
      </button>
      <button
        type="button"
        className="aprova-btn-interactive"
        style={{
          ...styles.quickActionButton,
          ...(chatBusy || chatLocked ? styles.quickActionButtonDisabled : {}),
        }}
        disabled={chatBusy || chatLocked}
        onClick={() =>
          onSendChatPrompt(
            "Como esse tema costuma cair em provas de concurso? Descreva padrões de cobrança comuns, sem inventar edições ou provas específicas."
          )
        }
      >
        Como cai na prova
      </button>
    </div>
  );

  const yaraMiniSessionCard = (
    <YaraMiniSessionCard session={yaraMiniSessionUi} subdued={chatBusy} />
  );

  const unifiedMessagesRegion = (
    <div className="aprova-chat-messages-shell aprova-chat-messages-shell--scroll-managed">
      <div
        ref={chatScrollRef}
        className="aprova-study-chat-messages-scroll aprova-study-unified-learn-scroll"
        onScroll={onScrollContainerScroll}
      >
        {!threadPrefaceActive && topicChatMessages.length === 0 ? (
          <div className="aprova-chat-thread-empty" role="status">
            <p className="aprova-chat-thread-empty-kicker">{YARA_NAME}</p>
            <p className="aprova-chat-thread-empty-title">Conteúdo em preparação</p>
            <p className="aprova-chat-thread-empty-body">
              Assim que a explicação deste tópico estiver pronta, ela aparece aqui como mensagem da {YARA_NAME}. Enquanto
              isso, você pode escrever abaixo — ou abra outro tópico no catálogo.
            </p>
          </div>
        ) : null}
        <div className="aprova-chat-thread">
          {threadPrefaceActive ? (
            explanationLoading ? (
              <ChatMessageBubble
                role="assistant"
                content=""
                userName={chatUserDisplayName}
                bubbleChildren={
                  <div className="aprova-study-explanation-in-thread">
                    <p className="aprova-study-explanation-thread-kicker">Leitura inicial · {selectedTopic.name}</p>
                    <TopicExplanationContent
                      explanationLoading={explanationLoading}
                      topicExplanation={topicExplanation}
                      topicTitle={selectedTopic.name}
                    />
                  </div>
                }
              />
            ) : explanationParts.length > 0 ? (
              explanationParts.slice(0, explanationVisibleCount).map((part, i) => (
                <ChatMessageBubble
                  key={part.id}
                  role="assistant"
                  content=""
                  userName={chatUserDisplayName}
                  bubbleChildren={
                    <div className="aprova-study-explanation-in-thread">
                      {i === 0 ? (
                        <p className="aprova-study-explanation-thread-kicker">Leitura inicial · {selectedTopic.name}</p>
                      ) : null}
                      {i > 0 && explanationParts.length > 1 && !part.title ? (
                        <p className="aprova-study-explanation-thread-kicker aprova-study-explanation-thread-kicker--step">
                          Parte {i + 1} de {explanationParts.length}
                        </p>
                      ) : null}
                      <TopicExplanationChunk sectionTitle={part.title} body={part.body} />
                    </div>
                  }
                />
              ))
            ) : (
              <ChatMessageBubble
                role="assistant"
                content=""
                userName={chatUserDisplayName}
                bubbleChildren={
                  <div className="aprova-study-explanation-in-thread">
                    <p className="aprova-study-explanation-thread-kicker">Leitura inicial · {selectedTopic.name}</p>
                    <TopicExplanationContent
                      explanationLoading={false}
                      topicExplanation={topicExplanation}
                      topicTitle={selectedTopic.name}
                    />
                  </div>
                }
              />
            )
          ) : null}
          {topicChatMessages.map((msg, index) => (
            <ChatMessageBubble
              key={index}
              role={msg.role}
              content={msg.content}
              userName={chatUserDisplayName}
            />
          ))}
        </div>
      </div>
      {showJumpToBottom ? (
        <button
          type="button"
          className="aprova-chat-jump-bottom"
          onClick={scrollToBottomSmooth}
          aria-label="Ir para o fim da conversa"
        >
          <ChevronsDown size={17} strokeWidth={2.2} aria-hidden />
          <span>Ir para o fim</span>
        </button>
      ) : null}
    </div>
  );

  const yaraActionFeedbackBand =
    yaraActionFeedback && typeof yaraActionFeedback.text === "string" && yaraActionFeedback.text.trim() ? (
      <div
        key={yaraActionFeedback.id}
        className="aprova-yara-action-feedback"
        role="status"
        aria-live="polite"
      >
        <span className="aprova-yara-action-feedback__glow" aria-hidden />
        <span className="aprova-yara-action-feedback__label">Yara</span>
        <p className="aprova-yara-action-feedback__text">{yaraActionFeedback.text.trim()}</p>
      </div>
    ) : null;

  const chatInputFooter = (
    <div className="aprova-chat-input-outer">
      {chatLocked && chatUpgradeCopy ? (
        <UsageLimitNotice
          title={chatUpgradeCopy.title}
          description={chatUpgradeCopy.description}
          remaining={remainingChat}
          ctaLabel={chatUpgradeCopy.cta}
          onUpgrade={onUpgradeToPro}
        />
      ) : remainingChat != null ? (
        <p className="aprova-usage-limit-notice__meta">
          Hoje restam <strong>{remainingChat}</strong> conversa{remainingChat !== 1 ? "s" : ""} com a Yara neste plano.
        </p>
      ) : usageQuota?.error ? (
        <p className="aprova-usage-limit-notice__meta">{usageQuota.error}</p>
      ) : null}
      <div className="aprova-chat-input-box">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          className="aprova-chat-textarea"
          rows={1}
          disabled={chatBusy || chatLocked}
          placeholder={`Pergunte à ${YARA_NAME} ou peça um resumo…`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!chatLocked) onSendChat();
            }
          }}
        />
        <button
          type="button"
          onClick={onSendChat}
          disabled={chatBusy || chatLocked}
          className="aprova-chat-send-btn-icon"
          aria-label={chatBusy ? "Aguarde…" : "Enviar mensagem"}
        >
          {chatSending ? (
            <span className="aprova-chat-send-spinner" aria-hidden>
              ···
            </span>
          ) : (
            <Send size={18} strokeWidth={2.2} />
          )}
        </button>
      </div>
    </div>
  );

  const chatExperienceUnified = (
    <div className="aprova-chat-surface aprova-chat-surface--topic-band">
      {chatYaraBlock}
      {chatHelperAside}
      {chatQuickActions}
      {yaraMiniSessionCard}
      {unifiedMessagesRegion}
      {yaraActionFeedbackBand}
      {chatInputFooter}
    </div>
  );

  const learnConversationPanel = (
    <div
      key="explanation"
      id="aprova-study-topic-chat-anchor"
      className="aprova-study-tab-panel aprova-study-topic-panel aprova-study-topic-panel--learn-conversation"
      role="tabpanel"
      aria-label="Conversa com a Yara e leitura do tópico"
    >
      {chatExperienceUnified}
      <details className="aprova-study-markdown-hint-details">
        <summary className="aprova-study-markdown-hint-summary">Dica de formatação do conteúdo</summary>
        <p className="aprova-study-markdown-hint-body">
          Títulos <code className="aprova-study-explanation-hint-code">##</code>, listas com traço, citações{" "}
          <code className="aprova-study-explanation-hint-code">&gt;</code>, negrito{" "}
          <code className="aprova-study-explanation-hint-code">**texto**</code>.
        </p>
      </details>
    </div>
  );

  const topicHero = (
    <header
      className={`aprova-study-topic-hero${compactHeader ? " aprova-study-topic-hero--compact" : ""}`}
      aria-labelledby="aprova-study-topic-heading"
    >
      {!compactHeader ? (
        <span className="aprova-study-welcome-kicker aprova-study-topic-hero-kicker">Tópico em foco</span>
      ) : null}
      {!compactHeader ? (
        <div className="aprova-study-topic-breadcrumb" aria-label="Caminho no catálogo">
          <span className="aprova-study-topic-crumb">{selectedContest?.name ?? "Concurso"}</span>
          <span className="aprova-study-topic-breadcrumb-sep" aria-hidden>
            /
          </span>
          <span className="aprova-study-topic-crumb">{selectedSubject?.name ?? "Matéria"}</span>
          <span className="aprova-study-topic-breadcrumb-sep" aria-hidden>
            /
          </span>
          <span className="aprova-study-topic-crumb aprova-study-topic-crumb--current">{selectedTopic.name}</span>
        </div>
      ) : null}
      <div className="aprova-study-topic-hero-headline">
        <h1 id="aprova-study-topic-heading" className="aprova-study-topic-hero-title">
          {selectedTopic.name}
        </h1>
        {!hideTopicBadge && !compactHeader ? (
          <span className="aprova-study-topic-hero-status">No plano</span>
        ) : null}
      </div>
      {!compactHeader ? (
        <p className="aprova-study-topic-hero-lead">
          Use a aba <strong>Conversa</strong> para ler e dialogar com a Yara no mesmo fluxo; em <strong>Questões</strong>{" "}
          você treina sem misturar com o chat.
        </p>
      ) : null}
      <div className="aprova-study-topic-meta">
        <span className="aprova-study-topic-meta-pill">
          <span className="aprova-study-topic-meta-key">Matéria</span>
          {selectedSubject?.name ?? "—"}
        </span>
        <span className="aprova-study-topic-meta-pill aprova-study-topic-meta-pill--mode">
          <span className="aprova-study-topic-meta-key">Modo ativo</span>
          {activeModeLabel}
        </span>
      </div>
    </header>
  );

  const topicShellAlerts = (
    <>
      {examBannerText && !hideExamBanner ? (
        <div className="aprova-study-topic-exam-banner" role="status">
          {examBannerText}
        </div>
      ) : null}
      {topicFlowError ? (
        <p className="aprova-study-topic-flow-error" role="alert">
          {topicFlowError}
        </p>
      ) : null}
    </>
  );

  const subTabsRow = (
    <div className="aprova-study-topic-tablist-shell" role="tablist" aria-label="Conteúdo do tópico">
      {tabDefs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={resolvedStudyViewTab === id}
          onClick={() => {
            setStudyViewTab(id);
            onStudyWorkspaceTabActivated?.();
          }}
          className={`aprova-study-topic-tab aprova-btn-interactive${resolvedStudyViewTab === id ? " aprova-study-topic-tab--active" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const gridClass = [
    "aprova-study-topic-grid",
    contextAside && !focusStreamlined ? "aprova-study-topic-grid--with-side" : "aprova-study-topic-grid--no-side",
    focusStreamlined ? "aprova-study-topic-grid--focus" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (focusStreamlined) {
    return (
      <section className="aprova-study-topic-shell" ref={studyContentAnchorRef}>
        {topicHero}
        {topicShellAlerts}
        <div className="aprova-panel-soft is-large aprova-study-topic-content-card aprova-study-topic-focus-card">
          {subTabsRow}
          {resolvedStudyViewTab === "explanation" ? learnConversationPanel : questionsPanelWide}
        </div>
      </section>
    );
  }

  return (
    <section className="aprova-study-topic-shell" ref={studyContentAnchorRef}>
      {topicHero}
      {topicShellAlerts}
      {subTabsRow}
      <div className={gridClass}>
        <section className="aprova-study-topic-main aprova-panel-soft is-large aprova-study-topic-content-card">
          {resolvedStudyViewTab === "explanation" ? learnConversationPanel : questionsPanelWide}
        </section>
        {contextAside ? (
          <aside
            className="aprova-study-topic-side aprova-panel-soft is-medium aprova-study-topic-content-card aprova-study-topic-side-surface"
            aria-label="Contexto, missão e atalhos"
          >
            {contextAside}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function StudyAreaPanelComponent({
  mainExamId,
  pinnedContestId,
  onboardingDone,
  resumeBannerVisible,
  onDismissResumeBanner,
  resumeJourney = null,
  onResumeJourneyAction,
  catalogError,
  topicFlowError,
  catalogLoading,
  explanationLoading,
  chatSending,
  chatHistoryClearing,
  onStartNewTopicChat,
  contests,
  subjectsList,
  topicsList,
  selectedContest,
  selectedSubject,
  selectedTopic,
  topicExplanation,
  topicChatMessages,
  topicQuestions,
  questionsLoading,
  questionsError,
  questionPicks,
  questionRevealed,
  chatInput,
  setChatInput,
  onPickContest,
  onPickSubject,
  onSelectTopic,
  onSendChat,
  onSendChatPrompt,
  onGenerateQuestions,
  onResetQuestions,
  onQuestionPick,
  onQuestionReveal,
  quizMistakeByKey,
  onRequestSimplerQuizMistake,
  onRequestTopicSubTab,
  onOpenYaraChatFromQuiz,
  recoveryTrainingMeta,
  recoveryFeedback,
  onStartRecoveryTraining,
  adaptiveSimuladoMeta = null,
  adaptiveSimuladoResult = null,
  onStartAdaptiveSimulado,
  onStudySubTabChange,
  examBannerText,
  studyFocusMode,
  onRequestStudyFocus,
  scrollIntoContentSignal,
  externalSubTab,
  onExternalSubTabConsumed,
  workspaceTabHint = "explanation",
  onStudyWorkspaceTabActivated,
  chatUserDisplayName = "Você",
  mainExamDisplayName = "",
  examSummaryLine = "—",
  weeklyMetaLine = "",
  overallProgressPct = null,
  subjectProgress = [],
  adaptiveFocusHint = "",
  suggestedNextTopicName = "",
  suggestedNextSubjectName = "",
  planProgressAligned = true,
  canContinueStudy = false,
  welcomeOnStartNow,
  suggestedTopicId = null,
  dailyMissions = [],
  planLines = [],
  quizWrong = 0,
  quizCorrect = 0,
  quizAttempts = 0,
  studyStreak = 0,
  topicsStudiedMain = null,
  topicsTotal = null,
  onReviewErrors,
  onDoQuestions,
  onMissionAction,
  hoursPerDay,
  studyReviewMode = "normal",
  studyReviewItems = [],
  studyReviewLoading = false,
  studyReviewError = "",
  studyReviewEmptyHint = "",
  onCloseStudyReview,
  onOpenReviewTopic,
  studyRecommendation = null,
  studyInsightsLoading = false,
  studyInsightsError = "",
  studyInsightTopicCount = 0,
  hasMainExamForInsights = true,
  onRecommendationOpenTopic,
  onRecommendationAskExplanation,
  studyMission = null,
  missionProgress = {},
  onMissionOpenTopic,
  onMissionAskAI,
  onMissionGoQuestions,
  yaraActionFeedback = null,
  yaraMiniSessionUi = null,
  examReadiness = null,
  featureAccess = null,
  usageQuota = null,
  onUpgradeToPro,
}) {
  const studyTopicAnchorRef = useRef(null);
  const manualSelectorRef = useRef(null);
  const trailSectionRef = useRef(null);
  const pinnedId = pinnedContestId?.trim() || null;
  const hasPinnedContest = Boolean(onboardingDone && pinnedId);
  /** Intenção explícita de trocar concurso — único motivo extra para mostrar a lista além de !selectedContest */
  const [swapContestOpen, setSwapContestOpen] = useState(false);

  const showContestColumn = shouldShowContestColumn(swapContestOpen, selectedContest);
  const showWelcomeShell = !studyFocusMode && !selectedTopic;

  const planKicker = useMemo(() => {
    const mainName = mainExamDisplayName?.trim();
    if (mainName && planProgressAligned) return `Plano sugerido para ${mainName}`;
    if (selectedContest?.name?.trim()) return `Plano em ${selectedContest.name.trim()}`;
    return "Plano personalizado com IA";
  }, [mainExamDisplayName, planProgressAligned, selectedContest]);

  const focusWeekLabel = useMemo(() => {
    const hint = adaptiveFocusHint?.trim();
    if (hint) {
      const curly = hint.match(/\u201C([^\u201D]+)\u201D/);
      if (curly?.[1]) return curly[1];
    }
    const sorted = [...(subjectProgress ?? [])].sort((a, b) => a.pct - b.pct);
    if (sorted[0]?.name) return sorted[0].name;
    if (suggestedNextSubjectName?.trim()) return suggestedNextSubjectName.trim();
    return selectedContest?.name?.trim() || "Seu preparo";
  }, [adaptiveFocusHint, subjectProgress, suggestedNextSubjectName, selectedContest?.name]);

  const prioritySubjectNames = useMemo(() => {
    const fromProgress = [...(subjectProgress ?? [])]
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
      .map((s) => s.name)
      .filter(Boolean);
    if (fromProgress.length) return fromProgress;
    return (subjectsList ?? []).slice(0, 3).map((s) => s.name).filter(Boolean);
  }, [subjectProgress, subjectsList]);

  const progressLabel = useMemo(() => {
    if (overallProgressPct == null || Number.isNaN(overallProgressPct)) {
      return "Abra alguns tópicos para medir seu avanço.";
    }
    return `${overallProgressPct}% do plano iniciado (tópicos já visitados no concurso principal)`;
  }, [overallProgressPct]);

  const nextStepTitle = useMemo(() => {
    if (suggestedNextTopicName?.trim()) return `Abra “${suggestedNextTopicName.trim()}”`;
    if (canContinueStudy) return "Retome onde você parou";
    return "Escolha matéria e tópico";
  }, [suggestedNextTopicName, canContinueStudy]);

  const nextStepBody = useMemo(() => {
    if (suggestedNextTopicName?.trim()) {
      return "Comece pela conversa com a Yara (leitura + dúvidas), faça um bloco de questões e refine no mesmo tópico.";
    }
    if (canContinueStudy) {
      return "Seu último tópico salvo será reaberto automaticamente; a Yara mantém o contexto da sessão.";
    }
    return "Defina o concurso principal no perfil para sugestões automáticas. Enquanto isso, use o catálogo abaixo.";
  }, [suggestedNextTopicName, canContinueStudy]);

  const heroLead = useMemo(
    () =>
      "A Yara organizou sua preparação com base na sua prova, no seu ritmo e na sua meta semanal. Em vez de começar do zero, você já entra com um próximo passo claro.",
    []
  );

  const handleWelcomeStart = useCallback(async () => {
    const opened = welcomeOnStartNow ? await welcomeOnStartNow() : false;
    if (!opened) {
      manualSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [welcomeOnStartNow]);

  const handleViewFullPlan = useCallback(() => {
    manualSelectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleViewFullTrail = useCallback(() => {
    trailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function handlePickContest(c) {
    onPickContest(c);
    setSwapContestOpen(false);
  }

  function restorePinnedContest() {
    const c = pinnedId ? contests.find((x) => x.id === pinnedId) : null;
    if (c) onPickContest(c);
    setSwapContestOpen(false);
  }

  const pinnedContestMissing =
    hasPinnedContest && !catalogLoading && !contests.some((c) => c.id === pinnedId);

  const contestHeadline =
    !mainExamId?.trim() && pinnedId && selectedContest?.id === pinnedId
      ? "Continuando seu foco em"
      : "Você está estudando para";

  const contestColumn = (
    <div className="aprova-study-catalog-panel">
      <div className="aprova-study-catalog-panel-head">
        <span className="aprova-study-catalog-panel-kicker">Passo 1</span>
        <h4 className="aprova-study-catalog-panel-title">Concurso</h4>
      </div>

      {catalogLoading ? (
        <div className="aprova-study-catalog-empty">Carregando concursos…</div>
      ) : contests.length === 0 ? (
        <div className="aprova-study-catalog-empty">
          Nenhum concurso cadastrado. Rode a migration e o seed no Supabase (pasta supabase/).
        </div>
      ) : (
        <div className="aprova-study-catalog-contest-list">
          {contests.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePickContest(c)}
              className={`aprova-study-catalog-contest-btn aprova-btn-interactive${selectedContest?.id === c.id ? " aprova-study-catalog-contest-btn--active" : ""}`}
            >
              <div className="aprova-study-catalog-contest-btn-inner">
                <p className="aprova-study-catalog-contest-name">{c.name}</p>
                <p className="aprova-study-catalog-contest-slug">{c.slug}</p>
              </div>
            </button>
          ))}
          {hasPinnedContest ? (
            <button type="button" onClick={restorePinnedContest} className="aprova-study-catalog-restore-btn">
              {mainExamId?.trim() ? "Voltar ao concurso principal" : "Voltar ao concurso salvo"}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );

  const subjectsColumn = (
    <div className="aprova-study-catalog-panel">
      <div className="aprova-study-catalog-panel-head">
        <span className="aprova-study-catalog-panel-kicker">
          {showContestColumn ? "Passo 2" : "Passo 1"}
        </span>
        <h4 className="aprova-study-catalog-panel-title">Matéria</h4>
      </div>

      {!selectedContest ? (
        <div className="aprova-study-catalog-empty">
          Escolha um concurso acima ou aguarde o carregamento automático.
        </div>
      ) : subjectsList.length === 0 ? (
        <div className="aprova-study-catalog-empty">Nenhuma matéria para este concurso.</div>
      ) : (
        <div className="aprova-study-catalog-subject-grid">
          {subjectsList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPickSubject(s)}
              className={`aprova-study-catalog-subject-chip aprova-btn-interactive${selectedSubject?.id === s.id ? " aprova-study-catalog-subject-chip--active" : ""}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const topicsColumn = (
    <div className="aprova-study-catalog-panel">
      <div className="aprova-study-catalog-panel-head">
        <span className="aprova-study-catalog-panel-kicker">
          {showContestColumn ? "Passo 3" : "Passo 2"}
        </span>
        <h4 className="aprova-study-catalog-panel-title">Tópico</h4>
      </div>

      {!selectedSubject ? (
        <div className="aprova-study-catalog-empty">Selecione uma matéria.</div>
      ) : topicsList.length === 0 ? (
        <div className="aprova-study-catalog-empty">Nenhum tópico cadastrado para esta matéria.</div>
      ) : (
        <div className="aprova-study-catalog-topic-grid">
          {topicsList.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onSelectTopic(topic)}
              className={`aprova-study-catalog-topic-card aprova-btn-interactive${selectedTopic?.id === topic.id ? " aprova-study-catalog-topic-card--active" : ""}`}
            >
              <p className="aprova-study-catalog-topic-name">{topic.name}</p>
              {topic.description ? (
                <p className="aprova-study-catalog-topic-desc">{topic.description}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const showReviewScreen = studyReviewMode === "review";

  const topicStudyContextAside =
    selectedTopic && !studyFocusMode ? (
      <StudyTopicSidebar
        studyInsightsError={studyInsightsError}
        hasMainExamForInsights={hasMainExamForInsights}
        studyInsightsLoading={studyInsightsLoading}
        studyRecommendation={studyRecommendation}
        studyInsightTopicCount={studyInsightTopicCount}
        onRecommendationOpenTopic={onRecommendationOpenTopic}
        onRecommendationAskExplanation={onRecommendationAskExplanation}
        studyMission={studyMission}
        missionProgress={missionProgress}
        onMissionOpenTopic={onMissionOpenTopic}
        onMissionGoQuestions={onMissionGoQuestions}
        onMissionAskAI={onMissionAskAI}
        onReviewErrors={onReviewErrors}
        onDoQuestions={onDoQuestions}
        examReadiness={examReadiness}
        featureAccess={featureAccess}
        onUpgradeToPro={onUpgradeToPro}
      />
    ) : null;

  return (
    <div
      className={`aprova-shell-wide aprova-study-area-root${studyFocusMode ? " aprova-study-area-root--focus" : ""}`}
    >
      {studyFocusMode ? (
        <div className="aprova-study-focus-strip" role="status">
          <span aria-hidden>⚡</span> Modo foco ativado
        </div>
      ) : null}

      {!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY ? (
        <p style={{ ...styles.errorText, marginTop: 16 }}>
          Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).
        </p>
      ) : null}

      {catalogError ? <p style={{ ...styles.errorText, marginTop: 16 }}>{catalogError}</p> : null}

      {showReviewScreen ? (
        <ReviewErrorsScreen
          items={studyReviewItems}
          loading={studyReviewLoading}
          error={studyReviewError}
          emptyHint={studyReviewEmptyHint}
          onBack={onCloseStudyReview}
          onOpenTopic={onOpenReviewTopic}
        />
      ) : (
        <section
          className={`aprova-study-shell${selectedTopic ? " aprova-study-shell--topic-open" : ""}`}
          aria-label="Área de estudo"
        >
      {!studyFocusMode && onboardingDone && !selectedTopic ? (
        <>
        <div className="aprova-ai-recommendation-wrap" aria-live="polite">
          {studyInsightsError ? (
            <div className="aprova-ai-recommendation-card aprova-ai-recommendation-card--error" role="status">
              <span className="aprova-ai-recommendation-kicker">Yara</span>
              <p className="aprova-ai-recommendation-text">{studyInsightsError}</p>
            </div>
          ) : null}

          {!studyInsightsError && !hasMainExamForInsights ? (
            <div className="aprova-ai-recommendation-card aprova-ai-recommendation-card--hint" role="status">
              <span className="aprova-ai-recommendation-kicker">Yara recomenda</span>
              <p className="aprova-ai-recommendation-text">
                Defina o <strong>concurso principal</strong> no perfil para eu analisar seus erros neste plano e
                sugerir revisão.
              </p>
            </div>
          ) : null}

          {!studyInsightsError && hasMainExamForInsights && studyInsightsLoading ? (
            <div className="aprova-ai-recommendation-card aprova-ai-recommendation-card--loading" aria-busy="true">
              <span className="aprova-ai-recommendation-kicker">Yara</span>
              <p className="aprova-ai-recommendation-text">Analisando seus últimos erros no concurso principal…</p>
            </div>
          ) : null}

          {!studyInsightsError &&
          hasMainExamForInsights &&
          !studyInsightsLoading &&
          studyRecommendation &&
          featureAccess?.canUsePremiumInsights !== false ? (
            <div
              className={`aprova-ai-recommendation-card aprova-ai-recommendation-card--${studyRecommendation.type}`}
            >
              <div className="aprova-ai-recommendation-body">
                <span className="aprova-ai-recommendation-kicker">Yara recomenda</span>
                <p className="aprova-ai-recommendation-text">{studyRecommendation.message}</p>
                {studyInsightTopicCount > 0 ? (
                  <p className="aprova-ai-recommendation-meta">
                    {studyInsightTopicCount} tópico{studyInsightTopicCount !== 1 ? "s" : ""} com erro registrado
                  </p>
                ) : null}
              </div>
              {studyRecommendation.topic_id &&
              studyRecommendation.subject_id &&
              studyRecommendation.contest_id ? (
                <div className="aprova-ai-recommendation-cta-row">
                  <button
                    type="button"
                    className="aprova-ai-recommendation-btn aprova-ai-recommendation-btn--primary"
                    onClick={() => onRecommendationOpenTopic?.(studyRecommendation)}
                  >
                    Revisar agora
                  </button>
                  <button
                    type="button"
                    className="aprova-ai-recommendation-btn aprova-ai-recommendation-btn--ghost"
                    onClick={() => onRecommendationAskExplanation?.(studyRecommendation)}
                  >
                    Falar com a Yara
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!studyInsightsError &&
          hasMainExamForInsights &&
          !studyInsightsLoading &&
          !studyRecommendation &&
          featureAccess?.canUsePremiumInsights !== false ? (
            <div className="aprova-ai-recommendation-card aprova-ai-recommendation-card--neutral" role="status">
              <span className="aprova-ai-recommendation-kicker">Yara</span>
              <p className="aprova-ai-recommendation-text">
                Nenhum erro de quiz registrado ainda no seu concurso principal. Quando errar questões, apareço aqui
                com prioridades.
              </p>
            </div>
          ) : null}

          {!studyInsightsError &&
          hasMainExamForInsights &&
          !studyInsightsLoading &&
          featureAccess &&
          !featureAccess.canUsePremiumInsights ? (
            <PremiumFeatureCard
              compact
              title="As prioridades inteligentes da Yara ficam no Pro."
              description="Continue estudando normalmente e ative o Yara Pro quando quiser recomendações mais profundas e diagnósticos mais refinados."
              bullets={[
                "Prioridade guiada por erros e retomadas",
                "Leitura mais profunda do momento",
                "Recomendações premium no dashboard",
              ]}
              ctaLabel="Liberar Yara Pro"
              onUpgrade={onUpgradeToPro}
            />
          ) : null}
        </div>

        {studyMission && hasMainExamForInsights && !studyInsightsLoading && featureAccess?.canUsePremiumInsights !== false ? (
          <div className="aprova-study-mission-card" aria-labelledby="aprova-study-mission-title">
            <span className="aprova-study-mission-kicker">Missão do dia</span>
            <h3 id="aprova-study-mission-title" className="aprova-study-mission-title">
              Foco: {studyMission.topic_name}
            </h3>
            <p className="aprova-study-mission-lead">
              Três passos para reforçar onde você mais precisa — marcamos o progresso automaticamente.
            </p>

            <ul className="aprova-mission-steps" role="list">
              {studyMission.steps.map((step) => {
                const done = isMissionStepDone(missionProgress, step);
                const practiceCount =
                  step.type === "practice"
                    ? Math.min(
                        step.target ?? MISSION_PRACTICE_TARGET,
                        typeof missionProgress.practice === "number" ? missionProgress.practice : 0
                      )
                    : 0;
                const practiceTarget = step.target ?? MISSION_PRACTICE_TARGET;

                return (
                  <li
                    key={step.id}
                    className={`aprova-mission-step ${done ? "aprova-mission-step--done" : ""}`}
                  >
                    <span className="aprova-mission-step-mark" aria-hidden>
                      {done ? "✓" : "○"}
                    </span>
                    <div className="aprova-mission-step-body">
                      <p className="aprova-mission-step-label">{step.label}</p>
                      {step.type === "practice" ? (
                        <p className="aprova-mission-step-meta">
                          {practiceCount}/{practiceTarget} acertos registrados neste tópico
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {isMissionFullyDone(studyMission, missionProgress) ? (
              <p className="aprova-study-mission-complete" role="status">
                Missão concluída — ótimo ritmo. Novos erros geram uma nova missão automaticamente.
              </p>
            ) : null}

            <div className="aprova-study-mission-cta-row">
              <button
                type="button"
                className="aprova-study-mission-btn aprova-study-mission-btn--primary"
                onClick={() => onMissionOpenTopic?.(studyMission)}
              >
                Começar missão
              </button>
              <button
                type="button"
                className="aprova-study-mission-btn aprova-study-mission-btn--secondary"
                onClick={() => onMissionGoQuestions?.(studyMission)}
              >
                Ir às questões
              </button>
              <button
                type="button"
                className="aprova-study-mission-btn aprova-study-mission-btn--ghost"
                onClick={() => onMissionAskAI?.(studyMission)}
              >
                Usar Yara
              </button>
            </div>
          </div>
        ) : null}
        </>
      ) : null}

      {!showWelcomeShell ? (
        <header className="aprova-study-catalog-header">
          <div className="aprova-study-catalog-header-copy">
            <h3 className={`aprova-study-catalog-title${studyFocusMode ? " aprova-study-catalog-title--compact" : ""}`}>
              Estudo com IA
            </h3>
            {!studyFocusMode ? (
              <p className="aprova-study-catalog-lead">
                {selectedContest && !showContestColumn ? (
                  <>
                    <strong>Matéria</strong> → <strong>tópico</strong> → abas <strong>Conversa</strong> (leitura + Yara) e{" "}
                    <strong>Questões</strong>.
                  </>
                ) : (
                  <>
                    <strong>Concurso</strong> → <strong>matéria</strong> → <strong>tópico</strong>. Depois, conversa com a
                    Yara e quiz no mesmo shell visual.
                  </>
                )}
              </p>
            ) : (
              <p className="aprova-study-catalog-lead aprova-study-catalog-lead--focus">Tela limpa. Só conteúdo.</p>
            )}
          </div>
          <div className="aprova-study-catalog-header-aside">
            {selectedTopic && onboardingDone ? (
              <button
                type="button"
                onClick={onRequestStudyFocus}
                disabled={studyFocusMode}
                className="aprova-study-focus-enter-btn"
                aria-disabled={studyFocusMode}
              >
                Entrar no foco
              </button>
            ) : null}
            {!studyFocusMode ? <span className="aprova-study-catalog-pill">Catálogo + IA</span> : null}
          </div>
        </header>
      ) : null}

      {selectedContest && !showContestColumn && !studyFocusMode ? (
        <div className="aprova-study-contest-context-bar aprova-contest-context-bar" role="region" aria-label="Concurso ativo">
          <div className="aprova-study-contest-context-bar-copy">
            {catalogLoading ? (
              <p className="aprova-study-contest-context-bar-line aprova-study-contest-context-bar-line--muted">
                Carregando seu concurso…
              </p>
            ) : pinnedContestMissing ? (
              <p className="aprova-study-contest-context-bar-line aprova-study-contest-context-bar-line--warn">
                Concurso salvo não encontrado na lista. Use <strong>Trocar concurso</strong> para escolher outro.
              </p>
            ) : (
              <p className="aprova-study-contest-context-bar-line" role="status">
                <span aria-hidden>📚</span> {contestHeadline}{" "}
                <strong className="aprova-study-contest-context-bar-strong">{selectedContest.name}</strong>
              </p>
            )}
          </div>
          {!(studyFocusMode && selectedTopic) ? (
            <button
              type="button"
              onClick={() => setSwapContestOpen(true)}
              className="aprova-btn-interactive aprova-study-change-contest-btn"
            >
              Trocar concurso
            </button>
          ) : null}
        </div>
      ) : null}

      {resumeBannerVisible ? (
        <div className="aprova-study-resume-banner" role="status">
          <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 0 }}>
            <span className="aprova-study-resume-banner-text">
              {resumeJourney?.headline || "Continuando de onde você parou."}
            </span>
            {resumeJourney?.whereLine ? (
              <span className="aprova-study-resume-banner-text" style={{ opacity: 0.86, fontSize: 13 }}>
                {resumeJourney.badgeLabel ? `${resumeJourney.badgeLabel} · ${resumeJourney.whereLine}` : resumeJourney.whereLine}
              </span>
            ) : null}
            {resumeJourney?.supportLine ? (
              <span className="aprova-study-resume-banner-text" style={{ opacity: 0.88, fontSize: 13 }}>
                {resumeJourney.supportLine}
              </span>
            ) : null}
            {resumeJourney?.whyLine ? (
              <span className="aprova-study-resume-banner-text" style={{ opacity: 0.92, fontSize: 13 }}>
                {resumeJourney.whyLine}
              </span>
            ) : null}
            {resumeJourney?.quickActions?.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {resumeJourney.quickActions.slice(0, 3).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onResumeJourneyAction?.(action.id)}
                    className="aprova-study-resume-banner-dismiss"
                    style={{ paddingInline: 12 }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onDismissResumeBanner} className="aprova-study-resume-banner-dismiss">
            Ok
          </button>
        </div>
      ) : null}

      {showWelcomeShell ? (
        <>
          {showContestColumn ? <div className="aprova-study-welcome-contest-wrap">{contestColumn}</div> : null}
          <StudyWelcomeShell
            planKicker={planKicker}
            heroTitle="Seu plano de estudo está em movimento"
            heroLead={heroLead}
            examFocusName={selectedContest?.name?.trim() || mainExamDisplayName?.trim() || "—"}
            daysRemainingLabel={examSummaryLine}
            focusWeekLabel={focusWeekLabel}
            weeklyMetaLine={weeklyMetaLine}
            nextStepTitle={nextStepTitle}
            nextStepBody={nextStepBody}
            prioritySubjectNames={prioritySubjectNames}
            progressPct={overallProgressPct}
            progressLabel={progressLabel}
            planProgressAligned={planProgressAligned}
            topicsStudiedMain={topicsStudiedMain}
            topicsTotal={topicsTotal}
            onStartNow={handleWelcomeStart}
            onViewFullTrail={handleViewFullTrail}
            onViewFullPlan={handleViewFullPlan}
            trailSectionRef={trailSectionRef}
            manualSectionRef={manualSelectorRef}
            catalogLoading={catalogLoading}
            selectedContest={selectedContest}
            subjectsList={subjectsList}
            selectedSubject={selectedSubject}
            onPickSubject={onPickSubject}
            topicsList={topicsList}
            selectedTopic={selectedTopic}
            onSelectTopic={onSelectTopic}
            suggestedTopicId={suggestedTopicId}
            dailyMissions={dailyMissions}
            planLines={planLines}
            quizWrong={quizWrong}
            quizCorrect={quizCorrect}
            quizAttempts={quizAttempts}
            studyStreak={studyStreak}
            onReviewErrors={onReviewErrors}
            onDoQuestions={onDoQuestions}
            onMissionAction={onMissionAction}
            hoursPerDay={hoursPerDay}
            chatUserDisplayName={chatUserDisplayName}
            examReadiness={examReadiness}
            simuladoBusy={Boolean(questionsLoading && adaptiveSimuladoMeta)}
            onStartAdaptiveSimulado={onStartAdaptiveSimulado}
            featureAccess={featureAccess}
            onUpgradeToPro={onUpgradeToPro}
          />
        </>
      ) : (
        <>
          {!studyFocusMode ? (
            <p className="aprova-study-path-section-label">
              {showContestColumn ? "Selecione o caminho de estudo" : "Matérias e tópicos"}
            </p>
          ) : null}
          <div
            className={[
              "aprova-study-path-grid",
              showContestColumn ? "aprova-study-path-grid--with-contest" : "",
              studyFocusMode && selectedTopic ? "aprova-study-path-grid--hidden" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {showContestColumn ? <div className="aprova-contest-picker-panel">{contestColumn}</div> : null}
            {subjectsColumn}
            {topicsColumn}
          </div>
        </>
      )}

      {selectedTopic ? (
        <TopicStudyWorkspace
          key={selectedTopic.id}
          selectedTopic={selectedTopic}
          selectedContest={selectedContest}
          selectedSubject={selectedSubject}
          examBannerText={examBannerText}
          topicFlowError={topicFlowError}
          explanationLoading={explanationLoading}
          topicExplanation={topicExplanation}
          topicQuestions={topicQuestions}
          questionsLoading={questionsLoading}
          questionsError={questionsError}
          questionPicks={questionPicks}
          questionRevealed={questionRevealed}
          topicChatMessages={topicChatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatSending={chatSending}
          chatHistoryClearing={chatHistoryClearing}
          onStartNewTopicChat={onStartNewTopicChat}
          onSendChat={onSendChat}
          onSendChatPrompt={onSendChatPrompt}
          onGenerateQuestions={onGenerateQuestions}
          onResetQuestions={onResetQuestions}
          onQuestionPick={onQuestionPick}
          onQuestionReveal={onQuestionReveal}
          quizMistakeByKey={quizMistakeByKey}
          onRequestSimplerQuizMistake={onRequestSimplerQuizMistake}
          onRequestTopicSubTab={onRequestTopicSubTab}
          onOpenYaraChatFromQuiz={onOpenYaraChatFromQuiz}
          recoveryTrainingMeta={recoveryTrainingMeta}
          recoveryFeedback={recoveryFeedback}
          onStartRecoveryTraining={onStartRecoveryTraining}
          simuladoMeta={adaptiveSimuladoMeta}
          simuladoResult={adaptiveSimuladoResult}
          onStudySubTabChange={onStudySubTabChange}
          studyContentAnchorRef={studyTopicAnchorRef}
          scrollIntoContentSignal={scrollIntoContentSignal}
          externalSubTab={externalSubTab}
          onExternalSubTabConsumed={onExternalSubTabConsumed}
          workspaceTabHint={workspaceTabHint}
          onStudyWorkspaceTabActivated={onStudyWorkspaceTabActivated}
          hideExamBanner={Boolean(studyFocusMode)}
          hideTopicBadge={Boolean(studyFocusMode)}
          compactHeader={Boolean(studyFocusMode)}
          workspaceSplitDisabled={Boolean(studyFocusMode)}
          chatUserDisplayName={chatUserDisplayName}
          contextAside={topicStudyContextAside}
          yaraActionFeedback={yaraActionFeedback}
          yaraMiniSessionUi={yaraMiniSessionUi}
          featureAccess={featureAccess}
          usageQuota={usageQuota}
          onUpgradeToPro={onUpgradeToPro}
        />
      ) : null}
        </section>
      )}
    </div>
  );
}

export const StudyAreaPanel = memo(StudyAreaPanelComponent);
