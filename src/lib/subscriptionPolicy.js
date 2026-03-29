export const FEATURE_QUOTAS = {
  inicial: {
    yaraChatDaily: 12,
    questionsDaily: 18,
    recoveryDaily: 1,
  },
};

export const FEATURE_KEYS = {
  yaraChat: "yaraChat",
  questions: "questions",
  advancedSimulado: "advancedSimulado",
  advancedRecovery: "advancedRecovery",
  premiumInsights: "premiumInsights",
};

function normalizeRemaining(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : null;
}

export function buildFeatureAccess(access, usageQuota) {
  const isPro = Boolean(access?.isPro);
  const hasActiveSubscription = Boolean(access?.hasActiveSubscription);
  const isInitialLike = !isPro;

  const remainingChatQuota = normalizeRemaining(usageQuota?.remainingChat);
  const remainingQuestionQuota = normalizeRemaining(usageQuota?.remainingQuestions);
  const remainingRecoveryQuota = normalizeRemaining(usageQuota?.remainingRecovery);

  const canUseYaraChat = isPro || remainingChatQuota === null || remainingChatQuota > 0;
  const canUseQuestions = isPro || remainingQuestionQuota === null || remainingQuestionQuota > 0;
  const canUseUnlimitedQuestions = isPro;
  const canUseAdvancedSimulado = isPro;
  const canUseAdvancedRecovery = isPro;
  const canUseBasicRecovery = isPro || remainingRecoveryQuota === null || remainingRecoveryQuota > 0;
  const canUsePremiumInsights = isPro;

  return {
    isPro,
    hasActiveSubscription,
    isInitialLike,
    planLabel: isPro ? "Yara Pro" : hasActiveSubscription ? "Yara Inicial" : "Acesso inicial",
    recommendedUpgrade: {
      planKey: "pro",
      billingCycle: access?.billingCycle === "yearly" ? "yearly" : "monthly",
    },
    canUseYaraChat,
    canUseQuestions,
    canUseUnlimitedQuestions,
    canUseAdvancedSimulado,
    canUseAdvancedRecovery,
    canUseBasicRecovery,
    canUsePremiumInsights,
    chatLimitReached: !canUseYaraChat,
    questionLimitReached: !canUseQuestions,
    recoveryLimitReached: !canUseBasicRecovery,
    remainingChatQuota,
    remainingQuestionQuota,
    remainingRecoveryQuota,
    getRemainingChatQuota: () => remainingChatQuota,
    getRemainingQuestionQuota: () => remainingQuestionQuota,
    getRemainingRecoveryQuota: () => remainingRecoveryQuota,
    getUpgradeCopy(featureKey) {
      switch (featureKey) {
        case FEATURE_KEYS.yaraChat:
          return {
            title: "Você atingiu o limite do Yara Inicial.",
            description: "Desbloqueie o Yara Pro para continuar com a Yara sem interrupções ao longo do dia.",
            cta: "Ativar Yara Pro",
          };
        case FEATURE_KEYS.questions:
          return {
            title: "Seu bloco básico de questões já foi usado hoje.",
            description: "Com o Yara Pro você continua treinando no ritmo que precisar, sem cortar sua sequência.",
            cta: "Liberar treino completo",
          };
        case FEATURE_KEYS.advancedSimulado:
          return {
            title: "Esse recurso faz parte da experiência completa da Yara.",
            description: "Ative o Yara Pro para liberar simulados adaptativos com leitura de ritmo e diagnóstico final.",
            cta: "Desbloquear simulado adaptativo",
          };
        case FEATURE_KEYS.advancedRecovery:
          return {
            title: "A recuperação contínua fica no Yara Pro.",
            description: "No Pro, a Yara acompanha seus erros sem limite e monta treinos de recuperação sempre que precisar.",
            cta: "Liberar recuperação avançada",
          };
        case FEATURE_KEYS.premiumInsights:
          return {
            title: "As leituras mais profundas da Yara ficam no Pro.",
            description: "Ative o Yara Pro para ver prioridades inteligentes, sinais de prontidão e recomendações mais profundas.",
            cta: "Ver insights premium",
          };
        default:
          return {
            title: "Continue com a experiência completa da Yara.",
            description: "Ative o Yara Pro para liberar os recursos premium do seu estudo.",
            cta: "Ativar Yara Pro",
          };
      }
    },
  };
}
