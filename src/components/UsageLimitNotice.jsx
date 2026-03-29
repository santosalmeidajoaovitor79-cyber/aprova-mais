import { UpgradeInlineNotice } from "./UpgradeInlineNotice.jsx";

export function UsageLimitNotice({
  title,
  description,
  remaining = null,
  ctaLabel = "Ativar Yara Pro",
  onUpgrade,
}) {
  return (
    <div className="aprova-usage-limit-notice-wrap">
      {remaining != null && remaining > 0 ? (
        <p className="aprova-usage-limit-notice__meta">
          Restam <strong>{remaining}</strong> uso{remaining !== 1 ? "s" : ""} hoje neste plano.
        </p>
      ) : null}
      <UpgradeInlineNotice
        title={title}
        description={description}
        ctaLabel={ctaLabel}
        onUpgrade={onUpgrade}
      />
    </div>
  );
}
