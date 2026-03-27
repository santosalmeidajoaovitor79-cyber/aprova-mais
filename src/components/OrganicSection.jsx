import { memo } from "react";
import { useMouseParallax } from "../hooks/useMouseParallax.js";

function OrganicSectionComponent({
  eyebrow,
  title,
  description,
  align = "left",
  children,
  className = "",
}) {
  const parallax = useMouseParallax();

  return (
    <section className={`aprova-organic-section ${className}`.trim()}>
      <div className="aprova-organic-section-inner">
        <div
          className={`aprova-organic-copy aprova-organic-copy-${align}`}
          style={{
            transform: `translate(${parallax.x * 10}px, ${parallax.y * 10}px)`,
          }}
        >
          {eyebrow ? (
            <div className="aprova-organic-eyebrow">
              <span className="aprova-organic-eyebrow-dot" />
              {eyebrow}
            </div>
          ) : null}

          {title ? <h2 className="aprova-organic-heading">{title}</h2> : null}
          {description ? <p className="aprova-organic-description">{description}</p> : null}
        </div>

        <div className="aprova-organic-section-content">{children}</div>
      </div>
    </section>
  );
}

export const OrganicSection = memo(OrganicSectionComponent);
