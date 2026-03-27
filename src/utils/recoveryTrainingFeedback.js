/**
 * Feedback curto pós mini treino de recuperação (tom Yara, sem chamada extra à IA).
 * @param {number} correct
 * @param {number} total
 * @returns {{ text: string, tone: 'positive' | 'caution' }}
 */
export function pickRecoveryTrainingFeedback(correct, total) {
  const t = Math.max(1, total);
  const c = Math.min(Math.max(0, correct), t);
  const ratio = c / t;

  const positive = [
    "Boa — você recuperou esse ponto. Pode seguir com mais confiança.",
    "Muito bem: o mini treino fechou a lacuna. Avance quando quiser.",
    "Perfeito aqui; o que confundia ficou mais claro.",
  ];
  const mixed = [
    "Você acertou uma parte — ainda vale revisar a teoria nesse ponto antes de seguir.",
    "Quase lá: dê uma passada na explicação do tópico para fixar o que ainda falhou.",
    "Bom esforço; um detalhe ainda pede atenção — vale voltar à teoria ou falar com a Yara no chat.",
  ];
  const caution = [
    "Esse ponto ainda pede calma — volte à explicação e, se quiser, use a Yara no chat.",
    "O mini treino mostrou que a confusão continua; revise a teoria com calma antes de avançar.",
    "Ainda não consolidou — sugerimos revisar o conteúdo teórico e treinar de novo depois.",
  ];

  const pool = ratio >= 1 ? positive : ratio >= 0.5 ? mixed : caution;
  const text = pool[Math.floor(Math.random() * pool.length)];
  const tone = ratio >= 1 ? "positive" : "caution";
  return { text, tone };
}
