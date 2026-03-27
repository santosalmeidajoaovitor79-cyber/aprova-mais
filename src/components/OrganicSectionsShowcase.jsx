import { memo } from "react";
import { OrganicSection } from "./OrganicSection.jsx";
import { StudyFlowSection } from "./StudyFlowSection.jsx";

function OrganicSectionsShowcaseComponent() {
  return (
    <div className="aprova-organic-sections">
      <StudyFlowSection />

      <div className="aprova-organic-divider" aria-hidden="true" />

      <OrganicSection
        eyebrow="Da matéria até a prova"
        title="Seu edital vira rota: do primeiro tópico ao dia D."
        description="Concurso escolhido, matérias, leitura, explicação com IA, questões do que você estudou e revisão — em sequência, sem perder o fio."
        align="center"
        className="aprova-organic-section-journey"
      >
        <div className="aprova-journey-line">
          <div className="aprova-journey-stop is-done">Concurso no radar</div>
          <div className="aprova-journey-stop is-active">Matéria em foco</div>
          <div className="aprova-journey-stop">Leitura</div>
          <div className="aprova-journey-stop">Explicação IA</div>
          <div className="aprova-journey-stop">Questões</div>
          <div className="aprova-journey-stop">Revisão</div>
          <div className="aprova-journey-stop aprova-journey-destination">Dia da prova</div>
        </div>
      </OrganicSection>

      <div className="aprova-organic-divider" aria-hidden="true" />

      <OrganicSection
        eyebrow="Por que Aprova+"
        title="Menos ruído na tela, mais clareza no que cai na sua prova."
        description="IA por tópico, questões alinhadas ao que você leu e uma trilha visual leve — para você estudar com foco até o edital que importa para você."
      >
        <div className="aprova-value-cloud">
          <span className="aprova-value-pill pill-1">Direção até o edital</span>
          <span className="aprova-value-pill pill-2">Questões do tópico atual</span>
          <span className="aprova-value-pill pill-3">Revisão sugerida pela IA</span>
          <span className="aprova-value-pill pill-4">Resumo do que importa</span>
          <span className="aprova-value-pill pill-5">Progresso até o dia D</span>
          <span className="aprova-value-pill pill-6">Seu próximo passo de estudo</span>
        </div>
      </OrganicSection>
    </div>
  );
}

export const OrganicSectionsShowcase = memo(OrganicSectionsShowcaseComponent);
