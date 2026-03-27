/** Indicador de prontidão (Readiness Engine) — tema lilás / dark premium. */
export function ExamReadinessStrip({ readiness, compact = false }) {
  if (!readiness || typeof readiness.score !== "number") return null;
  const { score, band, label, headline, bullets = [] } = readiness;
  return (
    <div
      className={`aprova-readiness-strip aprova-readiness-strip--${band}${compact ? " aprova-readiness-strip--compact" : ""}`}
      role="region"
      aria-label={`Prontidão para a prova: ${score} de 100, ${label}`}
    >
      <span className="aprova-readiness-strip__glow" aria-hidden />
      <div className="aprova-readiness-strip__row">
        <span className="aprova-readiness-strip__kicker">Prontidão</span>
        <span className="aprova-readiness-strip__score" aria-hidden>
          {score}
        </span>
        <span className="aprova-readiness-strip__sep" aria-hidden>
          ·
        </span>
        <span className="aprova-readiness-strip__label">{label}</span>
      </div>
      {headline ? <p className="aprova-readiness-strip__headline">{headline}</p> : null}
      {bullets.length ? (
        <ul className="aprova-readiness-strip__bullets">
          {bullets.slice(0, compact ? 2 : 3).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
