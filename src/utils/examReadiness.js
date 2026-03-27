import { normalizeLearningMemoryForPayload } from "./examDate.js";

/**
 * @typedef {{
 *   score: number,
 *   band: 'low' | 'medium' | 'high',
 *   label: string,
 *   headline: string,
 *   bullets: string[],
 *   coachHint: string,
 * }} ExamReadinessSnapshot
 */

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * @param {NonNullable<ReturnType<typeof normalizeLearningMemoryForPayload>>} lm
 * @returns {ExamReadinessSnapshot | null}
 */
export function computeExamReadinessFromNormalizedMemory(lm) {
  const attempts = lm.quizAttemptsInScope ?? 0;
  const acc = lm.globalAccuracyPercent;
  const days14 = lm.studyDaysLast14 ?? 0;
  const trend = lm.trendLabel ?? "unknown";
  const weak = Array.isArray(lm.weakTopics) ? lm.weakTopics : [];

  const accScore =
    attempts > 0 && acc != null ? clamp(acc, 0, 100) : 58;

  const consistScore = clamp(Math.round((days14 / 10) * 100), 0, 100);

  const weakErrSum = weak.reduce((s, w) => s + (typeof w.errors === "number" ? w.errors : 0), 0);
  const topErr = weak.length && typeof weak[0].errors === "number" ? weak[0].errors : 0;
  let spreadScore = 82;
  if (weakErrSum >= 3 && topErr > 0) {
    const concentration = topErr / weakErrSum;
    spreadScore = clamp(Math.round(100 - concentration * 38), 35, 100);
  } else if (!weak.length) {
    spreadScore = 88;
  }

  const trendBase =
    trend === "improving" ? 94 : trend === "stable" ? 78 : trend === "declining" ? 54 : 72;

  let score = Math.round(
    accScore * 0.48 + consistScore * 0.22 + spreadScore * 0.18 + trendBase * 0.12
  );

  if (trend === "improving") score = Math.min(100, score + 4);
  if (trend === "declining") score = Math.max(0, score - 5);

  score = clamp(score, 0, 100);

  const band = score < 50 ? "low" : score <= 75 ? "medium" : "high";
  const label =
    band === "high"
      ? "Bem encaminhado(a)"
      : band === "medium"
        ? "Em evolução"
        : "Ainda no alicerce";

  const weakNames = weak
    .map((w) => (typeof w.topicName === "string" ? w.topicName.trim() : ""))
    .filter(Boolean)
    .slice(0, 2);

  const trendPt =
    trend === "improving"
      ? "Sua taxa de acerto recente está melhorando — ótimo sinal de evolução."
      : trend === "declining"
        ? "Houve uma oscilação recente no quiz; é normal — vale revisar com calma o que falhou."
        : trend === "stable"
          ? "O desempenho no quiz está estável; pequenos ajustes de rotina costumam destravar o próximo degrau."
          : "Ainda estamos mapeando seu ritmo no quiz — continue registrando tentativas para a leitura ficar mais precisa.";

  const weakPt =
    weakNames.length > 0
      ? `Pontos com mais prática registrada: ${weakNames.join(" e ")} — bons candidatos a revisão espaçada.`
      : attempts < 4
        ? "Quanto mais questões você registrar, mais fina fica a leitura do que revisar."
        : "Os erros estão distribuídos; ótimo momento para consolidar padrões que confundem.";

  let rec =
    band === "low"
      ? "Sugestão: alterne leitura breve + poucas questões por dia, celebrando acertos pequenos."
      : band === "medium"
        ? "Sugestão: mantenha ritmo regular e uma rodada curta de revisão dos temas que mais pesam."
        : "Sugestão: refine detalhes e armadilhas típicas de prova, sem pular o descanso.";

  if (days14 < 3 && band !== "high") {
    rec = "Sugestão: tentar encaixar mais um dia de estudo nesta semana já ajuda a memória de longo prazo.";
  }

  const headline =
    band === "high"
      ? "Você está com boa tração — dá para mirar refinamento e confiança."
      : band === "medium"
        ? "Você está no caminho: consistência vai amplificar o que já funciona."
        : "Seu plano ainda está se fortalecendo — pequenos passos estáveis valem mais que pressa.";

  const coachHint =
    band === "low"
      ? "Tom acolhedor: nunca alarmista; enfatize micro-passos, revisão gentil e que oscilar é humano. Ofereça um próximo passo curto no app."
      : band === "medium"
        ? "Tom parceiro: reconheça esforço, sugira uma sequência leve (explicação → questões → chat) quando couber."
        : "Tom confiante mas humilde: elogie a base, proponha nuances ou simulações curtas; convide a manter o hábito.";

  const bullets = [weakPt, trendPt, rec].filter(Boolean).slice(0, 3);

  return {
    score,
    band,
    label,
    headline,
    bullets,
    coachHint,
  };
}

/**
 * @param {{ pct: number, ageDays: number } | null | undefined} simuladoHint — último mini simulado (local).
 */
function mergeSimuladoHint(snapshot, simuladoHint) {
  if (!snapshot || !simuladoHint || typeof simuladoHint.pct !== "number") return snapshot;
  const age = Number(simuladoHint.ageDays);
  if (!Number.isFinite(age) || age > 7) return snapshot;

  const delta = Math.round((simuladoHint.pct - 60) * 0.16);
  let score = clamp(snapshot.score + delta, 0, 100);
  const band = score < 50 ? "low" : score <= 75 ? "medium" : "high";
  const label =
    band === "high"
      ? "Bem encaminhado(a)"
      : band === "medium"
        ? "Em evolução"
        : "Ainda no alicerce";

  const simLine = `Checagem prática recente: mini simulado ~${Math.round(simuladoHint.pct)}% na sessão — use junto com o histórico para calibrar revisão e ritmo.`;
  const bullets = [simLine, ...snapshot.bullets].slice(0, 3);

  return {
    ...snapshot,
    score,
    band,
    label,
    bullets,
  };
}

/**
 * @param {unknown} rawLearningMemory — objeto learningMemory do snapshot (pré-payload).
 * @param {{ pct: number, ageDays: number } | null | undefined} [simuladoHint]
 * @returns {ExamReadinessSnapshot | null}
 */
export function buildExamReadinessFromLearningMemoryRaw(rawLearningMemory, simuladoHint) {
  const normalized = normalizeLearningMemoryForPayload(rawLearningMemory);
  if (!normalized) return null;
  const snap = computeExamReadinessFromNormalizedMemory(normalized);
  return mergeSimuladoHint(snap, simuladoHint ?? null);
}
