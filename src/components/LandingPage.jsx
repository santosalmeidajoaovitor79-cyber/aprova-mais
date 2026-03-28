import { createElement, memo } from "react";
import { ArrowRight, Brain, CheckCircle2, Compass, Sparkles, Target } from "lucide-react";

const trustPills = [
  "Plano com direção real",
  "Retomada inteligente",
  "Questões, revisão e Yara no mesmo fluxo",
];

const featureCards = [
  {
    icon: Compass,
    title: "Pare de estudar no escuro.",
    text: "O Aprova+ mostra o que merece atenção agora, o que pode esperar e qual é o próximo passo que mais aumenta sua evolução.",
  },
  {
    icon: Brain,
    title: "Entenda sem travar.",
    text: "Resumo, contraste, exemplos, prática e revisão no ritmo certo — sem despejar teoria fria quando você precisa de clareza.",
  },
  {
    icon: Target,
    title: "Retome sem perder tempo.",
    text: "Seu estudo continua do ponto exato em que você parou, com contexto, foco e um caminho pronto para seguir.",
  },
];

const flowSteps = [
  "Escolha sua prova",
  "Entre no tópico certo",
  "Receba explicação guiada",
  "Pratique com questões",
  "Revise o que mais trava",
  "Siga até o dia da prova",
];

function LandingPageComponent({ onStartRegister, onStartLogin, warpActive = false }) {
  return (
    <div className={`aprova-landing-shell aprova-landing-page${warpActive ? " aprova-landing-warp-out" : ""}`}>
      <div className="aprova-landing-bg" />

      <section className="aprova-landing-hero">
        <div className="aprova-landing-hero-copy">
          <div className="aprova-landing-brand">
            <div className="aprova-landing-brand-badge">A</div>
            <div>
              <strong>Aprova+</strong>
              <span>IA, questões e direção até a prova</span>
            </div>
          </div>

          <span className="aprova-landing-kicker">
            <Sparkles size={14} />
            YARA GUIA SEU ESTUDO EM TEMPO REAL
          </span>

          <h1>Passe com uma IA que guia seu estudo de verdade.</h1>

          <p>
            A Yara organiza seu foco, explica do seu jeito, antecipa erros e te conduz com mais
            clareza até a prova.
          </p>

          <div className="aprova-landing-pill-row">
            {trustPills.map((item) => (
              <span key={item} className="aprova-landing-pill">
                {item}
              </span>
            ))}
          </div>

          <div className="aprova-landing-cta-row">
            <button className="aprova-btn-interactive aprova-landing-primary" onClick={onStartRegister} type="button">
              Criar conta e começar
              <ArrowRight size={18} />
            </button>

            <button className="aprova-btn-interactive aprova-landing-secondary" onClick={onStartLogin} type="button">
              Já tenho conta
            </button>
          </div>
        </div>

        <div className="aprova-landing-hero-visual">
          <div className="aprova-orbit-card">
            <span className="aprova-orbit-label">Seu estudo, guiado por IA</span>

            <div className="aprova-orbit-core">
              <div>
                <strong>Mais clareza.</strong>
                <strong>Menos travamento.</strong>
              </div>
            </div>

            <div className="aprova-orbit-node node-top">Questões</div>
            <div className="aprova-orbit-node node-right">Próximo passo</div>
            <div className="aprova-orbit-node node-bottom">Revisão</div>
            <div className="aprova-orbit-node node-left">Explicação</div>

            <div className="aprova-orbit-status aprova-orbit-status-top">
              <span>Leitura do momento</span>
              <strong>Yara ajusta o ritmo</strong>
            </div>

            <div className="aprova-orbit-status aprova-orbit-status-bottom">
              <span>Plano vivo</span>
              <strong>Seu foco continua organizado</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="aprova-landing-section">
        <div className="aprova-section-heading">
          <span>Como funciona</span>
          <h2>Você não vai estudar perdido.</h2>
          <p>
            O Aprova+ junta direção, explicação, prática e retomada em uma experiência que faz você
            saber o que fazer agora e por quê.
          </p>
        </div>

        <div className="aprova-feature-grid">
          {featureCards.map((card) => (
            <article className="aprova-feature-card" key={card.title}>
              <div className="aprova-feature-icon">{createElement(card.icon, { size: 20 })}</div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aprova-landing-section aprova-yara-section">
        <div className="aprova-yara-copy">
          <span>Por que a Yara é diferente</span>
          <h2>A Yara não é só um chat.</h2>
          <p>
            Ela lê seu momento, organiza seu foco, antecipa tropeços e te conduz com mais
            constância até a prova.
          </p>

          <ul className="aprova-yara-list">
            <li>
              <CheckCircle2 size={18} />
              Explica no seu ritmo
            </li>
            <li>
              <CheckCircle2 size={18} />
              Reforça o ponto que mais trava
            </li>
            <li>
              <CheckCircle2 size={18} />
              Indica o melhor próximo passo
            </li>
            <li>
              <CheckCircle2 size={18} />
              Faz seu estudo continuar sem bagunça
            </li>
          </ul>
        </div>

        <div className="aprova-yara-panel">
          <div className="aprova-yara-panel-card">
            <span className="aprova-yara-mini-kicker">Yara no centro da experiência</span>
            <h3>Seu plano reage ao que você mostra.</h3>
            <p>
              Se você trava, a Yara simplifica. Se você avança, ela acelera. Se você oscila, ela
              reorganiza o caminho para você não se perder.
            </p>
          </div>
        </div>
      </section>

      <section className="aprova-landing-section">
        <div className="aprova-section-heading">
          <span>Do primeiro tópico ao dia da prova</span>
          <h2>Uma jornada que faz sentido.</h2>
          <p>
            Concurso, matéria, explicação, questões, revisão e retomada — tudo conectado em uma
            sequência clara.
          </p>
        </div>

        <div className="aprova-flow-row">
          {flowSteps.map((step, index) => (
            <div className="aprova-flow-step" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="aprova-landing-final">
        <span className="aprova-landing-final-kicker">Seu plano pode começar agora.</span>
        <h2>Entre no Aprova+ e deixe a Yara montar um começo mais claro, mais leve e muito mais inteligente.</h2>
        <p>
          Você não vai estudar solto. A Yara organiza seu foco desde o primeiro passo e mantém sua
          jornada conectada até a prova.
        </p>
        <button className="aprova-btn-interactive aprova-landing-primary" onClick={onStartRegister} type="button">
          Começar com a Yara
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export const LandingPage = memo(LandingPageComponent);
