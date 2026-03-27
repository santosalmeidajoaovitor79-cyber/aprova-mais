const PREFIX = "aprova.adaptiveSimulado.v1";

/**
 * @returns {{ at: string, correct: number, total: number, pct: number } | null}
 */
export function readLastSimuladoSession(userId, contestId) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const cid = typeof contestId === "string" ? contestId.trim() : "";
  if (!uid || !cid) return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}.${uid}.${cid}`);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const correct = Math.max(0, Math.floor(Number(o.correct) || 0));
    const total = Math.max(1, Math.floor(Number(o.total) || 1));
    const pct = Math.min(100, Math.max(0, Math.round(Number(o.pct) ?? (correct / total) * 100)));
    const at = typeof o.at === "string" ? o.at : "";
    if (!at) return null;
    return { at, correct, total, pct };
  } catch {
    return null;
  }
}

/**
 * @param {{ correct: number, total: number, pct: number }} stats
 */
export function writeLastSimuladoSession(userId, contestId, stats) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const cid = typeof contestId === "string" ? contestId.trim() : "";
  if (!uid || !cid) return;
  try {
    const payload = {
      at: new Date().toISOString(),
      correct: stats.correct,
      total: stats.total,
      pct: stats.pct,
    };
    localStorage.setItem(`${PREFIX}.${uid}.${cid}`, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function daysSinceIso(iso) {
  if (!iso || typeof iso !== "string") return 999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 999;
  return (Date.now() - t) / 86400000;
}
