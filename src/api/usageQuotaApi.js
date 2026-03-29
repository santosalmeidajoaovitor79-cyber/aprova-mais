async function readRpcSingle(promise, fallbackMessage) {
  const { data, error } = await promise;
  if (error) throw error;
  if (Array.isArray(data)) return data[0] ?? null;
  if (!data) throw new Error(fallbackMessage);
  return data;
}

export async function fetchDailyUsage(supabase) {
  return readRpcSingle(
    supabase.rpc("get_my_daily_usage"),
    "Não foi possível carregar seu uso diário."
  );
}

export async function consumeYaraChatQuota(supabase, amount = 1) {
  return readRpcSingle(
    supabase.rpc("consume_yara_chat_quota", { consume_amount: amount }),
    "Não foi possível registrar o uso do chat."
  );
}

export async function consumeQuestionsQuota(supabase, amount = 1) {
  return readRpcSingle(
    supabase.rpc("consume_questions_quota", { consume_amount: amount }),
    "Não foi possível registrar o uso das questões."
  );
}

export async function consumeRecoveryQuota(supabase, amount = 1) {
  return readRpcSingle(
    supabase.rpc("consume_recovery_quota", { consume_amount: amount }),
    "Não foi possível registrar o uso da recuperação."
  );
}
