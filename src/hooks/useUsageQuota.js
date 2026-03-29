import { useCallback, useEffect, useMemo, useState } from "react";
import {
  consumeQuestionsQuota,
  consumeRecoveryQuota,
  consumeYaraChatQuota,
  fetchDailyUsage,
} from "../api/usageQuotaApi.js";

const EMPTY_USAGE = {
  dateKey: null,
  planKey: "inicial",
  yaraChatCount: 0,
  questionsCount: 0,
  recoveryCount: 0,
  yaraChatLimit: 12,
  questionsLimit: 18,
  recoveryLimit: 1,
  remainingChat: 12,
  remainingQuestions: 18,
  remainingRecovery: 1,
};

function normalizeUsageRow(row) {
  if (!row) return EMPTY_USAGE;
  return {
    dateKey: row.date_key ?? null,
    planKey: row.plan_key ?? "inicial",
    yaraChatCount: Number(row.yara_chat_count) || 0,
    questionsCount: Number(row.questions_count) || 0,
    recoveryCount: Number(row.recovery_count) || 0,
    yaraChatLimit:
      row.yara_chat_limit == null ? null : Number.isFinite(Number(row.yara_chat_limit)) ? Number(row.yara_chat_limit) : null,
    questionsLimit:
      row.questions_limit == null ? null : Number.isFinite(Number(row.questions_limit)) ? Number(row.questions_limit) : null,
    recoveryLimit:
      row.recovery_limit == null ? null : Number.isFinite(Number(row.recovery_limit)) ? Number(row.recovery_limit) : null,
    remainingChat:
      row.remaining_chat == null ? null : Number.isFinite(Number(row.remaining_chat)) ? Number(row.remaining_chat) : 0,
    remainingQuestions:
      row.remaining_questions == null
        ? null
        : Number.isFinite(Number(row.remaining_questions))
          ? Number(row.remaining_questions)
          : 0,
    remainingRecovery:
      row.remaining_recovery == null
        ? null
        : Number.isFinite(Number(row.remaining_recovery))
          ? Number(row.remaining_recovery)
          : 0,
  };
}

export function useUsageQuota(supabase, session, access) {
  const [usage, setUsage] = useState(EMPTY_USAGE);
  const [loading, setLoading] = useState(Boolean(session?.user));
  const [error, setError] = useState("");

  const refreshUsage = useCallback(async () => {
    if (!supabase || !session?.user) {
      setUsage(EMPTY_USAGE);
      setLoading(false);
      setError("");
      return EMPTY_USAGE;
    }

    try {
      setLoading(true);
      setError("");
      const row = await fetchDailyUsage(supabase);
      const normalized = normalizeUsageRow(row);
      setUsage(normalized);
      return normalized;
    } catch (err) {
      const message = err?.message || "Não foi possível carregar seu uso diário.";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [supabase, session?.user]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  useEffect(() => {
    if (!session?.user) return undefined;
    const handleFocus = () => {
      void refreshUsage();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshUsage, session?.user]);

  const consume = useCallback(
    async (consumer, amount, fallbackMessage) => {
      if (!session?.user) {
        return {
          allowed: false,
          error: fallbackMessage,
        };
      }

      if (access?.isPro) {
        return {
          allowed: true,
          planKey: "pro",
          remainingCount: null,
          limitCount: null,
        };
      }

      try {
        setError("");
        const result = await consumer(supabase, amount);
        const latest = await refreshUsage();
        return {
          ...result,
          usage: latest,
          error: result?.allowed ? "" : fallbackMessage,
        };
      } catch (err) {
        const message = err?.message || fallbackMessage;
        setError(message);
        return {
          allowed: false,
          error: message,
        };
      }
    },
    [access?.isPro, refreshUsage, session?.user, supabase]
  );

  const consumeChatQuota = useCallback(
    (amount = 1) =>
      consume(
        consumeYaraChatQuota,
        amount,
        "Você atingiu o limite do Yara Inicial para falar com a Yara hoje."
      ),
    [consume]
  );

  const consumeQuestionQuota = useCallback(
    (amount = 3) =>
      consume(
        consumeQuestionsQuota,
        amount,
        "Seu bloco de questões do Yara Inicial já foi usado hoje."
      ),
    [consume]
  );

  const consumeRecoverySession = useCallback(
    (amount = 1) =>
      consume(
        consumeRecoveryQuota,
        amount,
        "A continuação da recuperação fica disponível no Yara Pro."
      ),
    [consume]
  );

  return useMemo(
    () => ({
      usage,
      loading,
      error,
      refreshUsage,
      consumeChatQuota,
      consumeQuestionQuota,
      consumeRecoverySession,
    }),
    [consumeChatQuota, consumeQuestionQuota, consumeRecoverySession, error, loading, refreshUsage, usage]
  );
}
