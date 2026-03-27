/** Mensagens fixas (não são dados inventados — só cópia de UX). */

export const QUIZ_POSITIVE_MESSAGES = [
  "Isso aí! Resposta certa — continue assim.",
  "Mandou bem. Você está consolidando o conteúdo.",
  "Perfeito. Esse tipo de raciocínio é o que a prova cobra.",
  "Acerto merecido. Aproveite para fixar o porquê da alternativa certa.",
  "Ótimo! Cada acerto válido reforça sua confiança para o dia da prova.",
  "Na mosca. Esse padrão de atenção ao enunciado é ouro.",
  "Excelente — você está transformando leitura em pontos.",
  "Certíssimo. Se puder, explique em voz alta por que as outras alternativas não fecham.",
  "Show! Um acerto de cada vez vira domínio no fim da semana.",
  "Muito bem. Celebre em 5 segundos e siga para a próxima.",
];

export const QUIZ_REVISE_MESSAGES = [
  "Não foi dessa vez — sem problema. Leia a explicação abaixo e volte à teoria se precisar.",
  "Erro faz parte do treino. Use a justificativa para entender o detalhe que escapou.",
  "Quase! Revise o conceito ligado a essa questão na aba Conversa.",
  "Boa tentativa. Anote mentalmente esse ponto e refaça questões parecidas depois.",
  "Importante errar agora para acertar na prova — foque na lógica da resposta certa abaixo.",
  "Essa pegou — ótimo sinal de que ainda há ganho fácil aqui. Leia a explicação com calma.",
  "Errar de propósito no treino é barato; na prova não. Use este erro como mapa do que revisar.",
  "Respira: identifique qual palavra-chave do enunciado você ignorou e tente de novo depois.",
  "Nada de culpa — compare sua linha de raciocínio com a justificativa e ajuste o próximo passo.",
  "Foco: uma ideia por vez. Se ainda ficar nebuloso, volte um trecho na Conversa com a Yara e retorne ao quiz.",
];

export function pickQuizFeedbackMessage(messages, stableKey) {
  const key = String(stableKey ?? "");
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h + key.charCodeAt(i) * (i + 1)) % 1009;
  }
  return messages[h % messages.length];
}
