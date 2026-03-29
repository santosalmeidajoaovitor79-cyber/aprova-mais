async function readRpcSingle(promise, fallbackMessage) {
  const { data, error } = await promise;
  if (error) throw error;
  if (Array.isArray(data)) return data[0] ?? null;
  if (!data) throw new Error(fallbackMessage);
  return data;
}

/** Data local (YYYY-MM-DD) para bater com `date_key` / `current_date` no Postgres. */
function todayLocalISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchDailyUsage(supabase) {
  // PostgREST não casa `.rpc("get_my_daily_usage")` sem corpo com `get_my_daily_usage(date)`;
  // é preciso passar o parâmetro nomeado (evita PGRST202).
  return readRpcSingle(
    supabase.rpc("get_my_daily_usage", { target_date: todayLocalISODate() }),
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
