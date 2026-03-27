/**
 * Rótulos curtos para passos da mini-sessão (UI).
 * @param {string} type
 */
export function labelForYaraActionType(type) {
  const t = typeof type === "string" ? type.trim() : "";
  const labels = {
    open_explanation: "Ver leitura e conversar",
    open_questions: "Fazer questões",
    start_quiz: "Fazer questões",
    focus_chat: "Continuar na conversa",
    open_review_errors: "Revisar erros do quiz",
    open_dashboard: "Ver o painel",
    open_topic: "Abrir o tópico sugerido",
  };
  return labels[t] || (t ? t.replace(/_/g, " ") : "Passo");
}

/**
 * Monta o estado visual da mini-sessão: só quando há 2+ passos (1º já executado pelo app).
 * @param {unknown} action — primeiro passo retornado pela API
 * @param {{ type: string, params?: Record<string, unknown> }[]} pendingNormalized — pendingSessionActions já normalizado
 * @returns {{ id: string, title: string, steps: { type: string, label: string, status: 'done' | 'current' | 'pending' }[] } | null}
 */
export function buildYaraMiniSessionSnapshot(action, pendingNormalized) {
  const pending = Array.isArray(pendingNormalized) ? pendingNormalized : [];
  if (!action || typeof action !== "object") return null;
  const ty = typeof action.type === "string" ? action.type.trim() : "";
  if (!ty || pending.length === 0) return null;

  const steps = [
    {
      type: ty,
      status: "done",
      label: labelForYaraActionType(ty),
    },
    ...pending.map((p, i) => {
      const pt = typeof p?.type === "string" ? p.type.trim() : "";
      return {
        type: pt,
        status: i === 0 ? "current" : "pending",
        label: labelForYaraActionType(pt),
      };
    }),
  ].filter((s) => s.type);

  if (steps.length < 2) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: "Sequência sugerida pela Yara",
    steps: steps.slice(0, 3),
  };
}
