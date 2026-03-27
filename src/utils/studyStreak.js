/**
 * Chave UTC YYYY-MM-DD a partir de ISO timestamptz do Supabase.
 */
export function utcDateKeyFromIso(iso) {
  if (!iso || typeof iso !== "string" || iso.length < 10) return "";
  return iso.slice(0, 10);
}

/**
 * Streak atual: dias seguidos com ao menos uma visita (user_topic_visits),
 * ancorado em hoje OU ontem (permitindo "ainda não estudei hoje" sem zerar).
 */
export function computeConsecutiveStudyStreak(visitRows) {
  const dateSet = new Set();
  for (const r of visitRows ?? []) {
    const k = utcDateKeyFromIso(r.visited_at);
    if (k) dateSet.add(k);
  }
  if (dateSet.size === 0) return 0;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  const yesterdayKey = y.toISOString().slice(0, 10);

  let anchor = null;
  if (dateSet.has(todayKey)) anchor = todayKey;
  else if (dateSet.has(yesterdayKey)) anchor = yesterdayKey;
  else return 0;

  let streak = 0;
  let cur = anchor;
  while (dateSet.has(cur)) {
    streak += 1;
    const d = new Date(`${cur}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cur = d.toISOString().slice(0, 10);
  }
  return streak;
}

/**
 * Agrupa tentativas de quiz por dia UTC e retorna taxa de acerto por data.
 * @param {{ attempted_at: string, is_correct: boolean }[]} rows
 * @returns {Map<string, { total: number, correct: number }>}
 */
export function accuracyByUtcDay(rows) {
  const map = new Map();
  for (const r of rows ?? []) {
    const day = utcDateKeyFromIso(r.attempted_at);
    if (!day) continue;
    if (!map.has(day)) map.set(day, { total: 0, correct: 0 });
    const o = map.get(day);
    o.total += 1;
    if (r.is_correct) o.correct += 1;
  }
  return map;
}

export function pctAccuracy(correct, total) {
  if (!total || total <= 0) return null;
  return Math.round((correct / total) * 100);
}
