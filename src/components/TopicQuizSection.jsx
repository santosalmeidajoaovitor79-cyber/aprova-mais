import { memo } from "react";
import { Sparkles } from "lucide-react";
import { styles } from "../styles/appStyles.js";
import {
  pickQuizFeedbackMessage,
  QUIZ_POSITIVE_MESSAGES,
  QUIZ_REVISE_MESSAGES,
} from "../utils/quizFeedbackMessages.js";
import { UpgradeInlineNotice } from "./UpgradeInlineNotice.jsx";
import { UsageLimitNotice } from "./UsageLimitNotice.jsx";

function buildMistakeChatPrompt(questionText, selectedLabel, correctLabel) {
  const stem = (questionText || "").trim().slice(0, 720);
  return `Acabei de errar uma questão neste tópico.

Enunciado:
${stem}

Eu marquei: ${selectedLabel || "—"}
A resposta correta é: ${correctLabel || "—"}

Explica o raciocínio passo a passo, de forma bem didática, e o que costuma confundir entre essas alternativas.`;
}

function YaraRecoveryBanner({ meta, feedback }) {
  const focusHint = meta?.likelyConfusion?.trim() || meta?.mistakeSummary?.trim() || "";

  return (
    <div className="aprova-yara-recovery" role="region" aria-label="Mini treino de recuperação da Yara">
      <div className="aprova-yara-recovery__glow" aria-hidden />
      <div className="aprova-yara-recovery__head">
        <span className="aprova-yara-recovery__badge">Recuperação</span>
        <h4 className="aprova-yara-recovery__title">Mini treino · Yara</h4>
        <p className="aprova-yara-recovery__lead">
          Questões novas focadas na confusão que você acabou de ver. Responda e revele cada uma — no final eu fecho o
          ciclo.
        </p>
        {focusHint ? (
          <p className="aprova-yara-recovery__focus">
            <span className="aprova-yara-recovery__focus-label">Foco</span>
            {focusHint.length > 220 ? `${focusHint.slice(0, 220)}…` : focusHint}
          </p>
        ) : null}
      </div>
      {feedback?.text ? (
        <div
          className={`aprova-yara-recovery__closing${feedback.tone === "positive" ? " is-positive" : " is-caution"}`}
          role="status"
        >
          <span className="aprova-yara-recovery__closing-kicker">Yara</span>
          <p className="aprova-yara-recovery__closing-text">{feedback.text}</p>
        </div>
      ) : (
        <p className="aprova-yara-recovery__pending">Quando todas estiverem reveladas, aparece o feedback final aqui.</p>
      )}
    </div>
  );
}

function YaraQuizMistakeCard({
  insight,
  disabledActions,
  onReviewTheory,
  onTrainMore,
  onExplainSimpler,
  onOpenChat,
}) {
  const loading = Boolean(insight?.loading);
  const err = insight?.error;
  const hasBody =
    !loading &&
    !err &&
    (insight?.mistakeSummary || insight?.whyCorrect || insight?.likelyConfusion);

  return (
    <div className="aprova-yara-quiz-insight" role="region" aria-label="Yara — apoio após erro">
      <div className="aprova-yara-quiz-insight__glow" aria-hidden />
      <div className="aprova-yara-quiz-insight__head">
        <span className="aprova-yara-quiz-insight__avatar" aria-hidden>
          <Sparkles size={18} strokeWidth={2.2} />
        </span>
        <div>
          <p className="aprova-yara-quiz-insight__kicker">Yara</p>
          <p className="aprova-yara-quiz-insight__title">Por que essa alternativa não fecha?</p>
        </div>
      </div>

      {loading ? (
        <p className="aprova-yara-quiz-insight__status">Gerando uma explicação curta para você…</p>
      ) : null}
      {err ? <p className="aprova-yara-quiz-insight__error">{err}</p> : null}

      {hasBody ? (
        <div className="aprova-yara-quiz-insight__body">
          {insight.mistakeSummary ? (
            <p className="aprova-yara-quiz-insight__block">
              <span className="aprova-yara-quiz-insight__label">Seu erro</span>
              {insight.mistakeSummary}
            </p>
          ) : null}
          {insight.whyCorrect ? (
            <p className="aprova-yara-quiz-insight__block">
              <span className="aprova-yara-quiz-insight__label">Por que a correta vale</span>
              {insight.whyCorrect}
            </p>
          ) : null}
          {insight.likelyConfusion ? (
            <p className="aprova-yara-quiz-insight__block">
              <span className="aprova-yara-quiz-insight__label">Confusão comum</span>
              {insight.likelyConfusion}
            </p>
          ) : null}
          {insight.simplified ? (
            <p className="aprova-yara-quiz-insight__hint">Versão em linguagem mais simples.</p>
          ) : null}
        </div>
      ) : null}

      <div className="aprova-yara-quiz-insight__actions">
        <button
          type="button"
          className="aprova-yara-quiz-insight__btn aprova-yara-quiz-insight__btn--primary"
          disabled={disabledActions}
          onClick={onReviewTheory}
        >
          Revisar teoria
        </button>
        <button
          type="button"
          className="aprova-yara-quiz-insight__btn"
          disabled={disabledActions || loading}
          onClick={onTrainMore}
        >
          Treinar mais
        </button>
        <button
          type="button"
          className="aprova-yara-quiz-insight__btn"
          disabled={disabledActions || loading || (!hasBody && !err)}
          onClick={onExplainSimpler}
        >
          Explicar melhor
        </button>
        <button
          type="button"
          className="aprova-yara-quiz-insight__btn"
          disabled={disabledActions || loading}
          onClick={onOpenChat}
        >
          Abrir no chat
        </button>
      </div>
    </div>
  );
}

function TopicQuizSectionComponent({
  questions,
  loading,
  error,
  disabled,
  picks,
  revealed,
  onPick,
  onReveal,
  onGenerate,
  onReset,
  inTopicShell = false,
  quizMistakeByKey = {},
  onRequestSimplerQuizMistake,
  onQuizReviewTheory,
  onQuizOpenYaraChat,
  recoveryTrainingMeta = null,
  recoveryFeedback = null,
  onStartRecoveryTraining,
  simuladoMeta = null,
  simuladoResult = null,
  featureAccess = null,
  usageQuota = null,
  onUpgradeToPro,
}) {
  const hasQuestions = Boolean(questions?.length);
  const simuladoActive = Boolean(simuladoMeta);
  const recoveryActive = Boolean(recoveryTrainingMeta) && !simuladoActive;
  const questionLimitReached = Boolean(featureAccess && !featureAccess.canUseQuestions);
  const recoveryLimitReached = Boolean(featureAccess && !featureAccess.canUseBasicRecovery);
  const questionUpgradeCopy = featureAccess?.getUpgradeCopy?.("questions");
  const recoveryUpgradeCopy = featureAccess?.getUpgradeCopy?.("advancedRecovery");
  const remainingQuestions = featureAccess?.getRemainingQuestionQuota?.();

  return (
    <section
      className={`aprova-quiz-section${inTopicShell ? " aprova-quiz-section--topic-shell" : ""}${recoveryActive ? " aprova-quiz-section--recovery" : ""}${simuladoActive ? " aprova-quiz-section--simulado" : ""}`}
      style={inTopicShell ? undefined : styles.quizSectionCard}
      aria-labelledby="quiz-section-title"
    >
      <div className={inTopicShell ? "aprova-quiz-section__header" : undefined} style={inTopicShell ? undefined : styles.quizSectionHeader}>
        <div>
          <h3
            id="quiz-section-title"
            className={inTopicShell ? "aprova-quiz-section__title" : undefined}
            style={inTopicShell ? undefined : styles.quizSectionTitle}
          >
            {simuladoActive ? "Mini simulado adaptativo" : "Questões para treinar"}
          </h3>
          <p
            className={inTopicShell ? "aprova-quiz-section__hint" : undefined}
            style={inTopicShell ? undefined : styles.quizSectionHint}
          >
            {recoveryActive
              ? "Mini treino de recuperação ativo — ao terminar, a Yara comenta seu desempenho. Use “Gerar novas questões” para voltar ao treino geral do tópico."
              : simuladoActive
                ? "Mini simulado adaptativo: poucas questões de vários tópicos para medir ritmo. Sem pressão — no final você vê o resumo e a Yara comenta no chat."
                : "Treino alinhado ao tópico: gere, refaça ou zere o bloco quando quiser."}
          </p>
        </div>
      </div>

      {recoveryActive ? <YaraRecoveryBanner meta={recoveryTrainingMeta} feedback={recoveryFeedback} /> : null}

      <div style={styles.quizActionsRow}>
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled || loading || questionLimitReached}
          className="aprova-btn-interactive"
          style={{
            ...styles.quickActionButtonPrimary,
            ...(disabled || loading || questionLimitReached ? styles.quickActionButtonDisabled : {}),
          }}
        >
          {loading
            ? "Gerando..."
            : hasQuestions
              ? simuladoActive
                ? "Treino do tópico (sair do simulado)"
                : recoveryActive
                  ? "Treino geral (sair da recuperação)"
                  : "Gerar novas questões"
              : simuladoActive
                ? "Gerar questões do tópico"
                : "Gerar 3 questões"}
        </button>
        {hasQuestions ? (
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="aprova-btn-interactive"
            style={{
              ...styles.quickActionButton,
              ...(loading ? styles.quickActionButtonDisabled : {}),
            }}
          >
            Resetar questões
          </button>
        ) : null}
      </div>

      {questionLimitReached && questionUpgradeCopy ? (
        <UsageLimitNotice
          title={questionUpgradeCopy.title}
          description={questionUpgradeCopy.description}
          remaining={remainingQuestions}
          ctaLabel={questionUpgradeCopy.cta}
          onUpgrade={onUpgradeToPro}
        />
      ) : usageQuota?.remainingQuestions != null && !simuladoActive ? (
        <p className="aprova-usage-limit-notice__meta">
          Hoje restam <strong>{usageQuota.remainingQuestions}</strong> questões neste plano.
        </p>
      ) : null}

      {recoveryLimitReached && recoveryUpgradeCopy && !recoveryActive ? (
        <UpgradeInlineNotice
          title={recoveryUpgradeCopy.title}
          description={recoveryUpgradeCopy.description}
          ctaLabel={recoveryUpgradeCopy.cta}
          onUpgrade={onUpgradeToPro}
          subtle
        />
      ) : null}

      {error ? <p style={{ ...styles.errorText, marginTop: 12 }}>{error}</p> : null}

      {hasQuestions ? (
        <div>
          {questions.map((q, qi) => {
            const key = q.id ?? `q-${qi}`;
            const pick = picks[key];
            const show = Boolean(revealed[key]);
            const correct = q.correctIndex;
            const options = Array.isArray(q.options) ? q.options : [];
            const srcName =
              typeof q.sourceTopicName === "string" && q.sourceTopicName.trim() ? q.sourceTopicName.trim() : "";

            return (
              <div
                key={key}
                className="aprova-quiz-question-card"
                style={{ ...styles.quizQuestionCard, marginTop: qi === 0 ? 12 : 16 }}
              >
                {simuladoActive && srcName ? (
                  <span className="aprova-quiz-source-topic" title="Tópico de origem neste simulado">
                    {srcName}
                  </span>
                ) : null}
                <p style={styles.quizQuestionText}>
                  {qi + 1}. {q.question}
                </p>
                <div style={styles.quizOptions}>
                  {options.map((opt, oi) => {
                    let extra = {};
                    if (show) {
                      if (oi === correct) extra = styles.quizOptionBtnCorrect;
                      else if (pick === oi && oi !== correct) extra = styles.quizOptionBtnWrong;
                    } else if (pick === oi) {
                      extra = styles.quizOptionBtnSelected;
                    }
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={show}
                        onClick={() => onPick(key, oi)}
                        className="aprova-quiz-option"
                        style={{ ...styles.quizOptionBtn, ...extra }}
                      >
                        <strong style={{ marginRight: 8 }}>{String.fromCharCode(65 + oi)}.</strong>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {!show ? (
                  <button
                    type="button"
                    className="aprova-btn-interactive"
                    style={styles.quizRevealBtn}
                    disabled={pick === undefined}
                    onClick={() => onReveal(key)}
                  >
                    Ver resposta
                  </button>
                ) : (
                  <>
                    {pick === correct ? (
                      <p style={styles.quizFeedbackPositive} role="status">
                        {pickQuizFeedbackMessage(QUIZ_POSITIVE_MESSAGES, key)}
                      </p>
                    ) : (
                      <p style={styles.quizFeedbackRevise} role="status">
                        {pickQuizFeedbackMessage(QUIZ_REVISE_MESSAGES, key)}
                      </p>
                    )}
                    {q.rationale ? (
                      <div style={styles.quizRationale}>
                        <strong>Explicação: </strong>
                        {q.rationale}
                      </div>
                    ) : null}
                    {pick !== correct && simuladoActive ? (
                      <p style={{ ...styles.sectionText, marginTop: 10, fontSize: "0.88rem", opacity: 0.88 }}>
                        No simulado a ideia é medir o ritmo — depois você pode voltar à aba Conversa com a Yara para
                        aprofundar este ponto.
                      </p>
                    ) : null}
                    {pick !== correct && !simuladoActive ? (
                      <YaraQuizMistakeCard
                        insight={quizMistakeByKey[key]}
                        disabledActions={disabled || loading || recoveryLimitReached}
                        onReviewTheory={() => onQuizReviewTheory?.()}
                        onTrainMore={() => void onStartRecoveryTraining?.(key)}
                        onExplainSimpler={() => onRequestSimplerQuizMistake?.(key)}
                        onOpenChat={() => {
                          const prompt = buildMistakeChatPrompt(
                            q.question,
                            options[pick],
                            options[correct]
                          );
                          onQuizOpenYaraChat?.(prompt);
                        }}
                      />
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : !loading ? (
        <p style={{ ...styles.sectionText, marginTop: 12, marginBottom: 0 }}>
          {simuladoActive
            ? "Montando seu mini simulado…"
            : 'Nenhuma questão neste bloco. Use "Gerar 3 questões" para criar um conjunto novo.'}
        </p>
      ) : null}

      {simuladoResult ? (
        <div className="aprova-simulado-summary" role="status">
          <p className="aprova-simulado-summary__kicker">Resultado do simulado</p>
          <p className="aprova-simulado-summary__title">
            {simuladoResult.correct} de {simuladoResult.total} acertos · {simuladoResult.pct}% na sessão
          </p>
          <ul className="aprova-simulado-summary__lines">
            <li>
              <strong>Onde foi melhor:</strong>{" "}
              {simuladoResult.bestLabels?.length ? simuladoResult.bestLabels.join(", ") : "—"}
            </li>
            <li>
              <strong>Onde precisa refino:</strong>{" "}
              {simuladoResult.worstLabels?.length ? simuladoResult.worstLabels.join(", ") : "—"}
              {!simuladoResult.worstLabels?.length && simuladoResult.total > 0 ? (
                <span className="aprova-simulado-summary__subtle">
                  {" "}
                  (nesta rodada foi um tópico só — o foco é o resultado geral)
                </span>
              ) : null}
            </li>
          </ul>
          <p className="aprova-simulado-summary__hint">
            A Yara também deixou um comentário no chat — abra quando quiser continuar com calma.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export const TopicQuizSection = memo(TopicQuizSectionComponent);
