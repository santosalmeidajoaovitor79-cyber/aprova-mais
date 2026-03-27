/**
 * Regra única de visibilidade da coluna "Concurso" na aba Estudo.
 *
 * Fonte de verdade visual: `selectedContest` + intenção explícita de troca (`swapContestOpen`).
 * `main_exam_id` / `last_contest_id` não entram aqui — só preenchem `selectedContest` via useStudyArea.
 *
 * @param {boolean} swapContestOpen usuário clicou "Trocar concurso"
 * @param {unknown} selectedContest concurso atual na sessão de estudo (truthy = definido)
 * @returns {boolean}
 */
export function shouldShowContestColumn(swapContestOpen, selectedContest) {
  return Boolean(swapContestOpen || !selectedContest);
}
