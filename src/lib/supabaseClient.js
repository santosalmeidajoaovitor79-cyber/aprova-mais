import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * Origem única para URL/chave pública — mesmo valor usado por `createClient` e por `billingApi`
 * (evita mismatch se alguém duplicar env em outro módulo).
 */
export const SUPABASE_PUBLIC_URL = rawUrl.replace(/\/$/, "");
export const SUPABASE_PUBLIC_ANON_KEY = rawAnonKey;

if (!SUPABASE_PUBLIC_URL || !SUPABASE_PUBLIC_ANON_KEY) {
  console.warn(
    "[Aprova] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example)."
  );
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  try {
    const host = SUPABASE_PUBLIC_URL ? new URL(SUPABASE_PUBLIC_URL).host : "(missing-url)";
    const refHint = host.includes(".") ? host.split(".")[0] : host;
    console.info("[Aprova][Supabase] cliente singleton", { host, projectRefHint: refHint });
  } catch {
    console.info("[Aprova][Supabase] cliente singleton — URL inválida para parse", {
      preview: SUPABASE_PUBLIC_URL ? `${SUPABASE_PUBLIC_URL.slice(0, 32)}…` : "(vazio)",
    });
  }
}

export const supabase = createClient(SUPABASE_PUBLIC_URL, SUPABASE_PUBLIC_ANON_KEY);
