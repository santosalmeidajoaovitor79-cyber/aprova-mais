import { supabase, SUPABASE_PUBLIC_URL } from "./supabaseClient.js";

function devLog(...args) {
  if (import.meta.env.DEV) {
    console.info("[Aprova][ensureValidSession]", ...args);
  }
}

function tokenTail(token) {
  if (!token || typeof token !== "string") return "(empty)";
  return token.length > 10 ? `…${token.slice(-8)}` : "(short)";
}

/** Extrai `ref` do JWT do Supabase (projeto emissor). */
export function readJwtProjectRef(accessToken) {
  if (!accessToken || typeof accessToken !== "string") return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return typeof json.ref === "string" ? json.ref : null;
  } catch {
    return null;
  }
}

/** Ref do projeto a partir de https://<ref>.supabase.co */
export function urlHostProjectRef(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  try {
    const host = new URL(urlStr.startsWith("http") ? urlStr : `https://${urlStr}`).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Garante access_token validado com o servidor (getUser), com refresh automático uma vez.
 * Usa o singleton `supabase` do supabaseClient (uma instância no app).
 *
 * @returns {Promise<{ ok: boolean, accessToken: string | null, user: import("@supabase/supabase-js").User | null, error: Error | null, reason: string | null }>}
 */
export async function ensureValidSession() {
  const { data, error: sessionError } = await supabase.auth.getSession();
  const session = data?.session ?? null;
  if (import.meta.env.DEV) {
    console.log("[Aprova][ensureValidSession] session", session);
  }

  if (sessionError) {
    devLog("getSession error", sessionError.message);
    return {
      ok: false,
      accessToken: null,
      user: null,
      error: sessionError,
      reason: "getSession_failed",
    };
  }

  if (!session?.access_token) {
    devLog("sem access_token na sessão local");
    return {
      ok: false,
      accessToken: null,
      user: null,
      error: new Error("NO_SESSION"),
      reason: "no_token",
    };
  }

  let accessToken = session.access_token;
  const hostRef = urlHostProjectRef(SUPABASE_PUBLIC_URL);
  const jwtRef = readJwtProjectRef(accessToken);
  if (hostRef && jwtRef && hostRef !== jwtRef.toLowerCase()) {
    devLog("mismatch JWT ref vs URL do app", { hostRef, jwtRef });
    return {
      ok: false,
      accessToken: null,
      user: null,
      error: new Error("PROJECT_MISMATCH"),
      reason: "project_mismatch",
    };
  }

  const firstUser = await supabase.auth.getUser(accessToken);
  if (!firstUser.error && firstUser.data?.user) {
    devLog("ok", { userId: firstUser.data.user.id, tokenTail: tokenTail(accessToken) });
    return {
      ok: true,
      accessToken,
      user: firstUser.data.user,
      error: null,
      reason: null,
    };
  }

  devLog("getUser falhou, tentando refreshSession", firstUser.error?.message);

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed?.session?.access_token) {
    devLog("refreshSession falhou", refreshError?.message);
    return {
      ok: false,
      accessToken: null,
      user: null,
      error: refreshError || new Error("REFRESH_FAILED"),
      reason: "refresh_failed",
    };
  }

  accessToken = refreshed.session.access_token;
  const jwtRef2 = readJwtProjectRef(accessToken);
  if (hostRef && jwtRef2 && hostRef !== jwtRef2.toLowerCase()) {
    devLog("mismatch após refresh", { hostRef, jwtRef: jwtRef2 });
    await supabase.auth.signOut().catch(() => {});
    return {
      ok: false,
      accessToken: null,
      user: null,
      error: new Error("PROJECT_MISMATCH"),
      reason: "project_mismatch",
    };
  }

  const secondUser = await supabase.auth.getUser(accessToken);
  if (!secondUser.error && secondUser.data?.user) {
    devLog("ok após refresh", { userId: secondUser.data.user.id, tokenTail: tokenTail(accessToken) });
    return {
      ok: true,
      accessToken,
      user: secondUser.data.user,
      error: null,
      reason: "after_refresh",
    };
  }

  devLog("getUser ainda inválido após refresh — signOut local", secondUser.error?.message);
  await supabase.auth.signOut().catch(() => {});
  return {
    ok: false,
    accessToken: null,
    user: null,
    error: secondUser.error || new Error("SESSION_INVALID"),
    reason: "invalid_after_refresh",
  };
}
