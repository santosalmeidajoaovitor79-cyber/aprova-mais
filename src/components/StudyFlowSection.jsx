import { memo } from "react";
import { useMouseParallax } from "../hooks/useMouseParallax.js";
import { STUDY_FLOW_PATHS, STUDY_FLOW_VIEWBOX } from "../data/studyFlowOrbit.js";

function StudyFlowSectionComponent() {
  const parallax = useMouseParallax();
  const px = parallax.x;
  const py = parallax.y;

  return (
    <section className="aprova-study-flow-section">
      <div className="aprova-study-flow-copy">
        <span className="aprova-study-flow-kicker">Fluxo de estudo</span>
        <h2 className="aprova-study-flow-title">A IA transforma matéria em progresso.</h2>
        <p className="aprova-study-flow-subtitle">
          Escolha a matéria, entre no tópico e siga um fluxo claro entre explicação, questões e revisão.
        </p>
      </div>

      <div className="aprova-study-flow-orbit">
        <div
          className="aprova-study-node aprova-study-node-center"
          style={{
            transform: `translate(calc(-50% + ${px * 10}px), calc(-50% + ${py * 10}px))`,
          }}
        >
          Escolha um tópico para estudar
        </div>

        <div
          className="aprova-study-node aprova-study-node-a"
          style={{ transform: `translate(calc(-50% + ${px * -8}px), calc(-50% + ${py * 8}px))` }}
        >
          Explicação guiada por IA
        </div>

        <div
          className="aprova-study-node aprova-study-node-b"
          style={{ transform: `translate(calc(-50% + ${px * 9}px), calc(-50% + ${py * -8}px))` }}
        >
          Questões do tópico
        </div>

        <div
          className="aprova-study-node aprova-study-node-c"
          style={{ transform: `translate(calc(-50% + ${px * -10}px), calc(-50% + ${py * -10}px))` }}
        >
          Revisão sugerida
        </div>

        <div
          className="aprova-study-node aprova-study-node-d"
          style={{ transform: `translate(calc(-50% + ${px * 8}px), calc(-50% + ${py * 7}px))` }}
        >
          Resumo do que importa
        </div>

        <div
          className="aprova-study-node aprova-study-node-e"
          style={{ transform: `translate(calc(-50% + ${px * 6}px), calc(-50% + ${py * 11}px))` }}
        >
          Próximo passo recomendado
        </div>

        <svg className="aprova-study-flow-svg" viewBox={STUDY_FLOW_VIEWBOX} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {STUDY_FLOW_PATHS.map((d, i) => (
            <path
              key={i}
              className={`aprova-study-flow-line aprova-study-flow-line--${i + 1}`}
              d={d}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}

export const StudyFlowSection = memo(StudyFlowSectionComponent);
