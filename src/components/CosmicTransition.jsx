import { memo } from "react";

function CosmicTransitionComponent({ active, mode }) {
  return (
    <div
      className={`aprova-cosmic-transition ${active ? "is-active" : ""} ${mode ? `is-${mode}` : ""}`}
      aria-hidden={!active}
    >
      <div className="aprova-cosmic-backdrop" />
      <div className="aprova-cosmic-vignette" />
      <div className="aprova-cosmic-core" />
      <div className="aprova-cosmic-ring aprova-cosmic-ring-1" />
      <div className="aprova-cosmic-ring aprova-cosmic-ring-2" />
      <div className="aprova-cosmic-ring aprova-cosmic-ring-3" />

      <div className="aprova-cosmic-streaks">
        <span className="aprova-streak s1" />
        <span className="aprova-streak s2" />
        <span className="aprova-streak s3" />
        <span className="aprova-streak s4" />
        <span className="aprova-streak s5" />
        <span className="aprova-streak s6" />
        <span className="aprova-streak s7" />
        <span className="aprova-streak s8" />
      </div>

      <div className="aprova-cosmic-particles">
        <span className="aprova-cosmic-particle p1" />
        <span className="aprova-cosmic-particle p2" />
        <span className="aprova-cosmic-particle p3" />
        <span className="aprova-cosmic-particle p4" />
        <span className="aprova-cosmic-particle p5" />
        <span className="aprova-cosmic-particle p6" />
      </div>

      <div className="aprova-cosmic-flash" />

      <div className="aprova-cosmic-label">
        {mode === "register" ? "Preparando seu espaço de estudo" : "Entrando no seu universo"}
      </div>
    </div>
  );
}

export const CosmicTransition = memo(CosmicTransitionComponent);
