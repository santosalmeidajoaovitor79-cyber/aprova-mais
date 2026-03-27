import { memo } from "react";
import { useMouseParallax } from "../hooks/useMouseParallax.js";
import { STUDY_FLOW_PATHS, STUDY_FLOW_VIEWBOX } from "../data/studyFlowOrbit.js";

function DashboardOrganicViewComponent({
  displayName,
  vibeLine,
  headline = "A IA transforma matéria em progresso.",
  subtitle,
  nodeMain,
  nodeA = "Explicação guiada por IA",
  nodeB = "Questões do tópico",
  nodeC = "Revisão sugerida",
  nodeD = "Resumo do que importa",
  nodeE = "Próximo passo recomendado",
}) {
  const parallax = useMouseParallax();
  const px = parallax.x;
  const py = parallax.y;

  return (
    <div className="aprova-dashboard-organic-intro">
      <div className="aprova-dashboard-header">
        <span className="aprova-dashboard-kicker">
          Seu painel · Oi, {displayName}
        </span>
        <h1 className="aprova-dashboard-title">{headline}</h1>
        <p className="aprova-dashboard-subtitle">
          {vibeLine ? <span className="aprova-dashboard-vibe">{vibeLine}</span> : null}
          {vibeLine && subtitle ? " · " : null}
          {subtitle}
        </p>
      </div>

      <div className="aprova-dashboard-river">
        <div
          className="aprova-dashboard-node node-main"
          style={{
            transform: `translate(calc(-50% + ${px * 10}px), calc(-50% + ${py * 10}px))`,
          }}
        >
          {nodeMain}
        </div>

        <div
          className="aprova-dashboard-node node-a"
          style={{ transform: `translate(calc(-50% + ${px * -8}px), calc(-50% + ${py * 8}px))` }}
        >
          {nodeA}
        </div>

        <div
          className="aprova-dashboard-node node-b"
          style={{ transform: `translate(calc(-50% + ${px * 9}px), calc(-50% + ${py * -8}px))` }}
        >
          {nodeB}
        </div>

        <div
          className="aprova-dashboard-node node-c"
          style={{ transform: `translate(calc(-50% + ${px * -10}px), calc(-50% + ${py * -10}px))` }}
        >
          {nodeC}
        </div>

        <div
          className="aprova-dashboard-node node-d"
          style={{ transform: `translate(calc(-50% + ${px * 8}px), calc(-50% + ${py * 7}px))` }}
        >
          {nodeD}
        </div>

        <div
          className="aprova-dashboard-node node-e"
          style={{ transform: `translate(calc(-50% + ${px * 6}px), calc(-50% + ${py * 11}px))` }}
        >
          {nodeE}
        </div>

        <svg className="aprova-dashboard-river-svg" viewBox={STUDY_FLOW_VIEWBOX} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {STUDY_FLOW_PATHS.map((d, i) => (
            <path
              key={i}
              className={`aprova-dashboard-line aprova-dashboard-line--${i + 1}`}
              d={d}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

export const DashboardOrganicView = memo(DashboardOrganicViewComponent);
