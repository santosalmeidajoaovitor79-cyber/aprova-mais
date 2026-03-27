/**
 * Mensagem “natural” para a Yara comentar o mini simulado (study-chat no tópico âncora).
 * @param {{
 *   correct: number,
 *   total: number,
 *   pct: number,
 *   bestLabels: string[],
 *   worstLabels: string[],
 * }} s
 */
export function buildSimuladoYaraUserPrompt(s) {
  const correct = Math.max(0, Math.floor(Number(s.correct) || 0));
  const total = Math.max(1, Math.floor(Number(s.total) || 1));
  const pct = Math.min(100, Math.max(0, Math.round(Number(s.pct) ?? (correct / total) * 100)));
  const best = Array.isArray(s.bestLabels) && s.bestLabels.length ? s.bestLabels.join(", ") : "—";
  const worst = Array.isArray(s.worstLabels) && s.worstLabels.length ? s.worstLabels.join(", ") : "—";
  return (
    `Acabei de terminar um mini simulado adaptativo neste concurso: ${correct} de ${total} acertos (~${pct}%). ` +
    `Onde me saí melhor: ${best}. Onde errei mais / preciso refino: ${worst}. ` +
    `Responda em 2–4 frases curtas, neste estilo (adapte ao meu resultado): ` +
    `1) reconheça o desempenho (ex.: “foi bem”, “deu para ver o que falta”, “ritmo ok”); ` +
    `2) diga qual parece o ponto mais crítico ainda; ` +
    `3) sugira o que vale revisar antes de avançar, sem culpa. ` +
    `Tom parceiro, motivador, sem alarmismo nem listas longas.`
  );
}
