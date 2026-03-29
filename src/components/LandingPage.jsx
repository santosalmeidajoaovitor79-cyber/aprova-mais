import { createElement, memo } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Orbit,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { PricingSection } from "./PricingSection.jsx";

const trustPills = [
  "Plano com direção real",
  "Retomada inteligente",
  "Questões, revisão e Yara no mesmo fluxo",
];

const featureCards = [
  {
    icon: Compass,
    title: "Pare de estudar sem direção.",
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
  "Entre na matéria certa",
  "Receba explicação guiada",
  "Pratique com questões",
  "Revise o que mais trava",
  "Siga até o dia da prova",
];

const differenceCards = [
  {
    icon: BookOpen,
    title: "Explicação no momento certo",
    text: "Sem jogar teoria demais quando o que você precisa é clareza para avançar.",
  },
  {
    icon: Wand2,
    title: "Retomada sem atrito",
    text: "Seu plano continua do ponto certo, com contexto, direção e menos ansiedade para voltar.",
  },
  {
    icon: Orbit,
    title: "Fluxo conectado",
    text: "Explicação, prática, revisão e próximo passo trabalhando juntos em vez de te puxar para lados diferentes.",
  },
];

function LandingPageComponent({ onStartRegister, onStartLogin, warpActive = false }) {
  return (
    <div className={`aprova-landing-shell aprova-landing-page${warpActive ? " aprova-landing-warp-out" : ""}`}>
      <div className="aprova-landing-bg" />
      <div className="aprova-landing-particles" aria-hidden="true" />

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

          <h1 className="aprova-reveal-1">Você não está estudando errado. Só está estudando sem direção.</h1>

          <p className="aprova-reveal-2">
            A maioria das pessoas se perde porque não sabe o que fazer depois de abrir o material.
            A Yara lê o seu momento e te guia passo a passo até a prova, com clareza.
          </p>

          <div className="aprova-landing-pill-row aprova-reveal-3">
            {trustPills.map((item) => (
              <span key={item} className="aprova-landing-pill">
                {item}
              </span>
            ))}
          </div>

          <div className="aprova-landing-cta-row aprova-reveal-4">
            <button className="aprova-btn-interactive aprova-landing-primary" onClick={onStartRegister} type="button">
              Começar com a Yara agora
              <ArrowRight size={18} />
            </button>

            <button className="aprova-btn-interactive aprova-landing-secondary" onClick={onStartLogin} type="button">
              Já tenho conta
            </button>
          </div>

          <div className="aprova-landing-mini-proof aprova-reveal-5">
            <strong>foco • + clareza • menos tempo perdido</strong>
            <span>A sensação muda quando alguém organiza o caminho em vez de te deixar se virar sozinho.</span>
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

            <div className="aprova-orbit-ring ring-1" />
            <div className="aprova-orbit-ring ring-2" />

            <div className="aprova-orbit-node node-top">Questões</div>
            <div className="aprova-orbit-node node-right">Próximo passo</div>
            <div className="aprova-orbit-node node-bottom">Revisão</div>
            <div className="aprova-orbit-node node-left">Explicação</div>
          </div>
        </div>
      </section>

      <section className="aprova-landing-section">
        <div className="aprova-section-heading">
          <span>Por que o Aprova+ existe</span>
          <h2>O problema não é falta de conteúdo.</h2>
          <p>
            Você abre o material, lê, tenta entender... mas não sabe se aquilo é importante, se já
            pode ir para questões ou se está pulando etapas.
          </p>
        </div>

        <div className="aprova-problem-strip">
          <div className="aprova-problem-strip-card">
            <strong>Falta saber o que fazer depois.</strong>
            <p>
              Você estuda, mas não tem clareza se deve insistir, revisar, praticar ou seguir para o
              próximo ponto.
            </p>
          </div>
          <div className="aprova-problem-strip-card">
            <strong>No fim, sobra esforço. Não avanço.</strong>
            <p>
              No final do dia, fica a sensação de esforço, mas não de avanço.
            </p>
          </div>
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
          <span>O que a Yara faz por você</span>
          <h2>A Yara organiza seu estudo por você.</h2>
          <p>
            Ela entende o que você está estudando, identifica onde você pode errar e decide o
            próximo passo certo.
          </p>

          <ul className="aprova-yara-list">
            <li>
              <CheckCircle2 size={18} />
              Se você precisa entender, ela explica
            </li>
            <li>
              <CheckCircle2 size={18} />
              Se precisa praticar, ela te leva para questões
            </li>
            <li>
              <CheckCircle2 size={18} />
              Se errou, ela te faz revisar do jeito certo
            </li>
            <li>
              <CheckCircle2 size={18} />
              Sem achismo. Sem perder tempo.
            </li>
          </ul>
        </div>

        <div className="aprova-yara-panel">
          <div className="aprova-yara-panel-card">
            <span className="aprova-yara-mini-kicker">Leitura do momento</span>
            <h3>Ela lê seu momento e devolve direção.</h3>
            <p>
              Quando você trava, ela simplifica. Quando você avança, ela acelera. Seu estudo
              continua do ponto certo, sem você precisar se remontar toda vez.
            </p>
          </div>
        </div>
      </section>

      <section className="aprova-landing-section">
        <div className="aprova-section-heading">
          <span>Como o estudo acontece</span>
          <h2>Do começo até a prova, com lógica.</h2>
          <p>
            Você entra sem saber por onde começar. Sai sabendo exatamente o que estudar, o que
            revisar e quando praticar.
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

      <section className="aprova-landing-section aprova-difference-section">
        <div className="aprova-section-heading">
          <span>Por que estudar assim é diferente</span>
          <h2>Não é mais um app de estudo.</h2>
          <p>
            Menos bagunça. Mais clareza. Mais constância. Menos sensação de estudar sozinho.
          </p>
        </div>

        <div className="aprova-difference-grid">
          {differenceCards.map((card) => (
            <div className="aprova-difference-card" key={card.title}>
              {createElement(card.icon, { size: 20 })}
              <strong>{card.title}</strong>
              <p>{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <PricingSection onRequireAuth={() => onStartRegister?.()} onLogin={onStartLogin} />

      <section className="aprova-landing-final">
        <span className="aprova-landing-final-kicker">Se você quer parar de estudar no escuro...</span>
        <h2>...e começar a estudar com direção real, esse é o momento.</h2>
        <button className="aprova-btn-interactive aprova-landing-primary" onClick={onStartRegister} type="button">
          Criar conta e começar certo
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export const LandingPage = memo(LandingPageComponent);
