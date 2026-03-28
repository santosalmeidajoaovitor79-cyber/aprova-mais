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

const yaraPoints = [
  "Organiza seu próximo passo com base no seu momento",
  "Explica de forma mais curta, profunda ou prática",
  "Antecipa erros e confusões antes das questões",
  "Te ajuda a voltar sem recomeçar tudo do zero",
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

          <h1 className="aprova-reveal-1">Passe com uma IA que guia seu estudo de verdade.</h1>

          <p className="aprova-reveal-2">
            A Yara organiza seu foco, explica do seu jeito, antecipa erros e te conduz com mais
            clareza até a prova.
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
              Criar conta e começar
              <ArrowRight size={18} />
            </button>

            <button className="aprova-btn-interactive aprova-landing-secondary" onClick={onStartLogin} type="button">
              Já tenho conta
            </button>
          </div>

          <div className="aprova-landing-mini-proof aprova-reveal-5">
            <strong>Você não precisa mais estudar tentando adivinhar o que fazer agora.</strong>
            <span>
              A Yara lê seu momento e te devolve direção. Quando você trava, ela simplifica.
              Quando você avança, ela acelera.
            </span>
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
          <h2>Estudar não costuma falhar por falta de conteúdo.</h2>
          <p>
            Falha porque o aluno perde direção, mistura prioridade com urgência e acaba estudando
            muito sem sentir progresso real.
          </p>
        </div>

        <div className="aprova-problem-strip">
          <div className="aprova-problem-strip-card">
            <strong>O problema não é só ter matéria demais.</strong>
            <p>
              É não saber o que fazer agora, o que insistir, o que revisar e como voltar quando o
              ritmo quebra.
            </p>
          </div>
          <div className="aprova-problem-strip-card">
            <strong>A ansiedade cresce quando falta direção.</strong>
            <p>
              A sensação vira esforço espalhado: muito estudo, pouca clareza e quase nenhuma
              continuidade.
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
          <h2>A Yara não é só um chat.</h2>
          <p>
            Ela entende seu momento, reorganiza seu foco, ajusta a explicação e te ajuda a seguir
            sem se perder no meio do caminho.
          </p>

          <ul className="aprova-yara-list">
            {yaraPoints.map((point) => (
              <li key={point}>
                <CheckCircle2 size={18} />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="aprova-yara-panel">
          <div className="aprova-yara-panel-card">
            <span className="aprova-yara-mini-kicker">Leitura do momento</span>
            <h3>Quando você trava, ela simplifica. Quando você avança, ela acelera.</h3>
            <p>
              A sensação muda: menos esforço espalhado, mais progresso que faz sentido. Seu estudo
              continua do ponto certo, sem você precisar se remontar toda vez.
            </p>
          </div>
        </div>
      </section>

      <section className="aprova-landing-section">
        <div className="aprova-section-heading">
          <span>Como o estudo acontece</span>
          <h2>Do primeiro tópico ao dia da prova.</h2>
          <p>
            Concurso, matéria, explicação, questões, revisão e retomada — tudo conectado em uma
            jornada que realmente faz sentido.
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
          <h2>Menos bagunça. Mais clareza. Mais constância.</h2>
          <p>
            Menos sensação de estudar sozinho. Menos travamento. Mais acompanhamento real para você
            sentir o estudo andar.
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

      <section className="aprova-landing-final">
        <span className="aprova-landing-final-kicker">Seu plano pode começar agora</span>
        <h2>Entre no Aprova+ e deixe a Yara montar um começo mais claro, mais leve e muito mais inteligente.</h2>
        <button className="aprova-btn-interactive aprova-landing-primary" onClick={onStartRegister} type="button">
          Começar com a Yara
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
}

export const LandingPage = memo(LandingPageComponent);
