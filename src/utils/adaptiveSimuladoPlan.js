/**
 * Une tópicos fracos (quiz) com tópicos visitados recentemente — base do simulado adaptativo.
 * @param {Array<{ topicId?: string, topicName?: string, errors?: number, attempts?: number }>} weakTopics
 * @param {string[]} recentTopicIds — mais recente primeiro
 * @param {Record<string, string | undefined>} topicNamesById
 */
function mergeWeakTopicsWithRecent(weakTopics, recentTopicIds, topicNamesById) {
  const names =
    topicNamesById && typeof topicNamesById === "object" && !Array.isArray(topicNamesById)
      ? topicNamesById
      : {};

  const weakRows = (Array.isArray(weakTopics) ? weakTopics : [])
    .filter((w) => w && typeof w.topicId === "string" && w.topicId.trim())
    .map((w) => {
      const topicId = w.topicId.trim();
      return {
        topicId,
        topicName:
          (typeof w.topicName === "string" && w.topicName.trim()) ||
          (typeof names[topicId] === "string" && names[topicId].trim()) ||
          "Tópico",
        errors: Math.max(0, Math.floor(Number(w.errors) || 0)),
        attempts: Math.max(0, Math.floor(Number(w.attempts) || 0)),
        recentOnly: false,
        recencyIdx: 99,
      };
    });

  const seen = new Set(weakRows.map((r) => r.topicId));
  let recencyIdx = 0;
  const recentRows = [];
  for (const id of Array.isArray(recentTopicIds) ? recentTopicIds : []) {
    const tid = typeof id === "string" ? id.trim() : "";
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    recentRows.push({
      topicId: tid,
      topicName: (typeof names[tid] === "string" && names[tid].trim()) || "Tópico",
      errors: 0,
      attempts: 0,
      recentOnly: true,
      recencyIdx: recencyIdx++,
    });
    if (weakRows.length + recentRows.length >= 12) break;
  }

  return [...weakRows, ...recentRows];
}

/**
 * Distribui N questões entre tópicos fracos (peso ~ erros) + visitas recentes (peso menor),
 * com piso por tópico e teto por chamada à API.
 * @param {Array<{ topicId?: string, topicName?: string, errors?: number, attempts?: number }>} weakTopics
 * @param {number} totalQuestions — 5, 8 ou 10
 * @param {string[]} [recentTopicIds]
 * @param {Record<string, string | undefined>} [topicNamesById]
 * @returns {{ topicId: string, topicName: string, count: number }[] | null}
 */
export function buildAdaptiveSimuladoAllocations(
  weakTopics,
  totalQuestions,
  recentTopicIds = [],
  topicNamesById = {}
) {
  const n = Math.min(10, Math.max(5, Math.floor(Number(totalQuestions) || 8)));
  const merged = mergeWeakTopicsWithRecent(weakTopics, recentTopicIds, topicNamesById);
  if (!merged.length) return null;

  merged.sort((a, b) => {
    if (b.errors !== a.errors) return b.errors - a.errors;
    if (b.attempts !== a.attempts) return b.attempts - a.attempts;
    if (a.recentOnly !== b.recentOnly) return a.recentOnly ? 1 : -1;
    return (a.recencyIdx ?? 99) - (b.recencyIdx ?? 99);
  });

  const maxTopics = Math.min(4, merged.length);
  const use = merged.slice(0, maxTopics);
  const weights = use.map((t) => {
    if (t.recentOnly) {
      const recBoost = Math.max(0.2, 0.65 - (t.recencyIdx ?? 0) * 0.08);
      return 1.05 + recBoost;
    }
    return t.errors + 1 + Math.min(2, t.attempts * 0.04);
  });
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;

  /** @type {number[]} */
  const counts = weights.map((w) => Math.max(1, Math.round((w / wsum) * n)));

  const perTopicMax = (ti) =>
    Math.min(6, Math.max(2, Math.ceil(n / use.length) + 1 + Math.min(2, use[ti]?.errors ?? 0)));

  for (let i = 0; i < counts.length; i++) {
    counts[i] = Math.min(counts[i], perTopicMax(i));
  }

  let sum = counts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (sum > n && guard < 48) {
    const j = guard % counts.length;
    if (counts[j] > 1) counts[j]--;
    sum--;
    guard++;
  }
  guard = 0;
  while (sum < n && guard < 48) {
    const j = guard % counts.length;
    if (counts[j] < perTopicMax(j)) counts[j]++;
    sum++;
    guard++;
  }

  return use.map((t, i) => ({
    topicId: t.topicId,
    topicName: t.topicName,
    count: counts[i],
  }));
}

/**
 * Quando não há “tópicos fracos” no histórico, distribui no catálogo do concurso.
 * @param {Array<{ id: string, name?: string, subject_id?: string }>} allTopics
 * @param {string | null | undefined} selectedTopicId
 * @param {number} totalQuestions — 5, 8 ou 10
 */
export function buildFallbackSimuladoAllocations(allTopics, selectedTopicId, totalQuestions) {
  const n = Math.min(10, Math.max(5, Math.floor(Number(totalQuestions) || 8)));
  const rows = (Array.isArray(allTopics) ? allTopics : []).filter((t) => t && typeof t.id === "string" && t.id.trim());
  if (!rows.length) return null;

  /** @type {typeof rows} */
  const pool = [];
  if (selectedTopicId) {
    const sel = rows.find((t) => t.id === selectedTopicId);
    if (sel) pool.push(sel);
  }
  const rest = shuffleArray(rows.filter((t) => !pool.some((p) => p.id === t.id)));
  for (const t of rest) {
    pool.push(t);
    if (pool.length >= 4) break;
  }
  if (!pool.length) return null;

  const k = pool.length;
  const base = Math.floor(n / k);
  let rem = n - base * k;
  return pool
    .map((t, i) => ({
      topicId: t.id.trim(),
      topicName: (typeof t.name === "string" && t.name.trim()) || "Tópico",
      count: base + (i < rem ? 1 : 0),
    }))
    .filter((a) => a.count > 0);
}

/**
 * Cada chamada à edge aceita no máx. 6 questões — quebra alocações maiores.
 * @param {{ topicId: string, topicName: string, count: number }[]} allocations
 */
export function expandAllocationChunks(allocations) {
  /** @type {{ topicId: string, topicName: string, count: number }[]} */
  const out = [];
  for (const a of allocations || []) {
    let rem = Math.max(0, Math.floor(Number(a.count) || 0));
    const topicId = typeof a.topicId === "string" ? a.topicId.trim() : "";
    if (!topicId) continue;
    const topicName = (typeof a.topicName === "string" && a.topicName.trim()) || "Tópico";
    while (rem > 0) {
      const c = Math.min(6, rem);
      out.push({ topicId, topicName, count: c });
      rem -= c;
    }
  }
  return out;
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
