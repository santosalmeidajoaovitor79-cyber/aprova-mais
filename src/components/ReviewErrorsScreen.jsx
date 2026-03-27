import { memo } from "react";

function indexToLetter(i) {
  if (typeof i !== "number" || i < 0 || i > 25) return null;
  return String.fromCharCode(65 + i);
}

function ReviewErrorsScreenComponent({
  items,
  loading,
  error,
  emptyHint,
  onBack,
  onOpenTopic,
}) {
  const showList = !loading && !error && items.length > 0;
  const showEmpty = !loading && !error && items.length === 0;

  return (
    <section className="aprova-review-screen" aria-label="Revisão de erros do quiz">
      <div className="aprova-review-screen-inner">
        <header className="aprova-review-header">
          <div className="aprova-review-header-copy">
            <span className="aprova-review-kicker">Revisão guiada</span>
            <h2 className="aprova-review-title">Revise seus erros recentes</h2>
            <p className="aprova-review-lead">
              Reforce os pontos em que você ainda precisa ganhar segurança — mesmos dados do seu painel (concurso
              principal).
            </p>
          </div>
          <button type="button" className="aprova-study-welcome-cta-secondary" onClick={onBack}>
            Voltar ao estudo
          </button>
        </header>

        {emptyHint && !error ? (
          <div className="aprova-review-state aprova-review-state--hint" role="status">
            {emptyHint}
          </div>
        ) : null}

        {loading ? (
          <div className="aprova-review-state" role="status">
            Carregando seus erros…
          </div>
        ) : null}

        {!loading && error ? (
          <div className="aprova-review-state aprova-review-state--error" role="alert">
            {error}
          </div>
        ) : null}

        {showEmpty ? (
          <div className="aprova-review-state" role="status">
            Você ainda não tem erros registrados para revisar neste concurso — ou eles foram feitos antes de passarmos a
            salvar o texto das questões. Continue treinando e revelando respostas no quiz para acumular histórico aqui.
          </div>
        ) : null}

        {showList ? (
          <div className="aprova-review-list">
            {items.map((item) => {
              const hasStem = Boolean(item.questionStem?.trim());
              const letterWrong = indexToLetter(item.selectedIndex);
              const letterOk = indexToLetter(item.correctIndex);
              const canOpen =
                item.topicId &&
                item.subjectId &&
                item.contestId &&
                typeof onOpenTopic === "function";

              return (
                <article className="aprova-review-card" key={item.id}>
                  <div className="aprova-review-card-top">
                    {item.subjectName ? (
                      <span className="aprova-review-mini-pill">{item.subjectName}</span>
                    ) : null}
                    <span className="aprova-review-mini-pill">{item.topicName}</span>
                    {item.attemptedAt ? (
                      <span className="aprova-review-mini-pill aprova-review-mini-pill--muted">
                        {new Date(item.attemptedAt).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="aprova-review-question">
                    {hasStem ? item.questionStem : "Registro anterior — texto da pergunta não foi salvo na época."}
                  </h3>

                  {!hasStem && (letterWrong || letterOk) ? (
                    <p className="aprova-review-index-fallback">
                      {letterWrong ? (
                        <>
                          <strong>Alternativa marcada:</strong> {letterWrong}
                        </>
                      ) : null}
                      {letterWrong && letterOk ? " · " : null}
                      {letterOk ? (
                        <>
                          <strong>Correta:</strong> {letterOk}
                        </>
                      ) : null}
                    </p>
                  ) : null}

                  {item.selectedLabel?.trim() ? (
                    <p className="aprova-review-user-answer">
                      <strong>Sua resposta:</strong> {item.selectedLabel}
                    </p>
                  ) : letterWrong && hasStem ? (
                    <p className="aprova-review-user-answer">
                      <strong>Sua resposta:</strong> alternativa {letterWrong}
                    </p>
                  ) : null}

                  {item.correctLabel?.trim() ? (
                    <p className="aprova-review-correct-answer">
                      <strong>Resposta correta:</strong> {item.correctLabel}
                    </p>
                  ) : letterOk ? (
                    <p className="aprova-review-correct-answer">
                      <strong>Resposta correta:</strong> alternativa {letterOk}
                    </p>
                  ) : (
                    <p className="aprova-review-correct-answer">
                      <strong>Resposta correta:</strong> não informada
                    </p>
                  )}

                  {canOpen ? (
                    <div className="aprova-review-card-actions">
                      <button
                        type="button"
                        className="aprova-study-welcome-cta-primary"
                        onClick={() =>
                          onOpenTopic({
                            contestId: item.contestId,
                            subjectId: item.subjectId,
                            topicId: item.topicId,
                          })
                        }
                      >
                        Abrir tópico e treinar
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const ReviewErrorsScreen = memo(ReviewErrorsScreenComponent);
