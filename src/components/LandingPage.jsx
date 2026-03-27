import { memo } from "react";
import { styles } from "../styles/appStyles.js";

function LandingPageComponent({ onStartRegister, onStartLogin, warpActive = false }) {
  return (
    <div
      style={styles.landingPage}
      className={`aprova-landing-page${warpActive ? " aprova-landing-warp-out" : ""}`}
    >
      <div className="aprova-organic-background" aria-hidden="true">
        <div className="aprova-gradient-orb aprova-orb-a" />
        <div className="aprova-gradient-orb aprova-orb-b" />
        <div className="aprova-gradient-orb aprova-orb-c" />

        <div className="aprova-mesh-line aprova-mesh-line-1" />
        <div className="aprova-mesh-line aprova-mesh-line-2" />
        <div className="aprova-mesh-line aprova-mesh-line-3" />

        <div className="aprova-noise-layer" />

        <span className="aprova-particle aprova-p1" />
        <span className="aprova-particle aprova-p2" />
        <span className="aprova-particle aprova-p3" />
        <span className="aprova-particle aprova-p4" />
        <span className="aprova-particle aprova-p5" />
        <span className="aprova-particle aprova-p6" />
        <span className="aprova-particle aprova-p7" />
        <span className="aprova-particle aprova-p8" />
      </div>

      <div style={styles.landingInner} className="aprova-landing-inner-organic">
        <div style={styles.landingContent} className="aprova-landing-content">
          <div style={styles.landingLeft} className="aprova-landing-left">
            <p className="aprova-landing-reveal aprova-landing-reveal--brand" style={styles.landingBrand}>
              Aprova+
            </p>

            <div
              className="aprova-landing-reveal aprova-landing-reveal--eyebrow"
              style={styles.landingEyebrow}
            >
              <span className="aprova-landing-eyebrow-dot" />
              IA que guia seus estudos sem poluir a tela
            </div>

            <h1
              className="aprova-landing-reveal aprova-landing-reveal--title aprova-landing-title"
              style={styles.landingTitle}
            >
              Estudar para prova
              <span className="aprova-title-glow"> sem bagunça</span>,
              <br />
              com uma experiência viva
              <br />
              e realmente fluida.
            </h1>

            <p className="aprova-landing-reveal aprova-landing-reveal--subtitle" style={styles.landingSubtitle}>
              IA por tópico, questões do que você leu, explicações mais claras e uma trilha visual leve — sem
              cards, sem caixas duras, sem aparência travada.
            </p>

            <div className="aprova-landing-reveal aprova-landing-reveal--flow" style={styles.landingFlowText}>
              <span>ENEM</span>
              <span>•</span>
              <span>Concursos</span>
              <span>•</span>
              <span>Polícia Penal</span>
              <span>•</span>
              <span>INSS</span>
              <span>•</span>
              <span>OAB</span>
            </div>

            <p className="aprova-landing-reveal aprova-landing-reveal--foot aprova-landing-foot" style={styles.landingFoot}>
              Defina a prova no perfil: o app organiza concurso, tópicos e treino para você enxergar com clareza o
              que falta até o dia D.
            </p>

            <div className="aprova-landing-actions-wrap" style={styles.landingActions}>
              <button
                type="button"
                className="aprova-btn-interactive aprova-landing-cta-primary"
                onClick={onStartRegister}
                style={styles.landingBtnPrimary}
              >
                Criar conta e estudar
              </button>

              <button
                type="button"
                className="aprova-btn-interactive aprova-landing-cta-secondary"
                onClick={onStartLogin}
                style={styles.landingBtnSecondary}
              >
                Já tenho conta — entrar
              </button>
            </div>
          </div>

          <div style={styles.landingRight} className="aprova-landing-right">
            <div className="aprova-hero-visual">
              <div className="aprova-central-glow" />

              <div className="aprova-floating-word aprova-word-1">Redação</div>
              <div className="aprova-floating-word aprova-word-2">Raciocínio Lógico</div>
              <div className="aprova-floating-word aprova-word-3">Direito Penal</div>
              <div className="aprova-floating-word aprova-word-4">Atualidades</div>
              <div className="aprova-floating-word aprova-word-5">Português</div>
              <div className="aprova-floating-word aprova-word-6">Questões</div>

              <div className="aprova-energy-ring aprova-ring-1" />
              <div className="aprova-energy-ring aprova-ring-2" />
              <div className="aprova-energy-ring aprova-ring-3" />

              <div className="aprova-core-text">
                <span className="aprova-core-small">Seu estudo, guiado por IA</span>
                <strong>Mais clareza. Menos ruído.</strong>
              </div>

              <svg
                className="aprova-connection-svg"
                viewBox="0 0 700 700"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  className="aprova-flow-path aprova-path-1"
                  d="M350 350 C420 220, 540 210, 600 290"
                />
                <path
                  className="aprova-flow-path aprova-path-2"
                  d="M350 350 C500 330, 550 430, 560 520"
                />
                <path
                  className="aprova-flow-path aprova-path-3"
                  d="M350 350 C250 250, 170 240, 120 300"
                />
                <path
                  className="aprova-flow-path aprova-path-4"
                  d="M350 350 C220 430, 210 520, 290 585"
                />
                <path
                  className="aprova-flow-path aprova-path-5"
                  d="M350 350 C350 180, 340 140, 350 95"
                />
                <path
                  className="aprova-flow-path aprova-path-6"
                  d="M350 350 C350 500, 360 555, 350 620"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const LandingPage = memo(LandingPageComponent);
