export function PremiumFeatureCard({
  eyebrow = "Yara Pro",
  title,
  description,
  bullets = [],
  ctaLabel = "Ativar Yara Pro",
  onUpgrade,
  compact = false,
  className = "",
}) {
  return (
    <section
      className={`aprova-premium-feature-card${compact ? " aprova-premium-feature-card--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <span className="aprova-premium-feature-card__glow" aria-hidden />
      <span className="aprova-premium-feature-card__eyebrow">{eyebrow}</span>
      <h3 className="aprova-premium-feature-card__title">{title}</h3>
      <p className="aprova-premium-feature-card__description">{description}</p>
      {bullets.length ? (
        <ul className="aprova-premium-feature-card__list">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {typeof onUpgrade === "function" ? (
        <button type="button" className="aprova-premium-feature-card__cta" onClick={onUpgrade}>
          {ctaLabel}
        </button>
      ) : null}
    </section>
  );
}
