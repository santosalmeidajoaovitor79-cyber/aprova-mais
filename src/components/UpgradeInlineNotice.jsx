export function UpgradeInlineNotice({
  title,
  description,
  ctaLabel = "Ativar Yara Pro",
  onUpgrade,
  subtle = false,
}) {
  return (
    <div className={`aprova-upgrade-notice${subtle ? " aprova-upgrade-notice--subtle" : ""}`} role="status">
      <div className="aprova-upgrade-notice__glow" aria-hidden />
      <div className="aprova-upgrade-notice__body">
        <span className="aprova-upgrade-notice__kicker">Yara Pro</span>
        <strong className="aprova-upgrade-notice__title">{title}</strong>
        {description ? <p className="aprova-upgrade-notice__text">{description}</p> : null}
      </div>
      {typeof onUpgrade === "function" ? (
        <button type="button" className="aprova-upgrade-notice__cta" onClick={onUpgrade}>
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}
