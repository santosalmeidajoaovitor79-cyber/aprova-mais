import { memo } from "react";
import {
  parseExplanationSections,
  parseExplanationBodySegments,
  splitInlineEmphasis,
} from "../utils/parseExplanationSections.js";

function InlineText({ text }) {
  const parts = splitInlineEmphasis(text);
  return parts.map((p, i) =>
    p.strong ? (
      <mark key={i} className="aprova-study-topic-explanation-mark">
        {p.text}
      </mark>
    ) : (
      <span key={i}>{p.text}</span>
    )
  );
}

function BodySegment({ segment }) {
  if (segment.type === "p") {
    return (
      <p className="aprova-study-topic-explanation-para">
        <InlineText text={segment.text} />
      </p>
    );
  }
  if (segment.type === "list") {
    return (
      <ul className="aprova-study-topic-explanation-list" role="list">
        {segment.items.map((item, i) => (
          <li key={i} className="aprova-study-topic-explanation-li">
            <span className="aprova-study-topic-explanation-li-mark" aria-hidden />
            <span className="aprova-study-topic-explanation-li-text">
              <InlineText text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (segment.type === "callout") {
    return (
      <aside className="aprova-study-topic-explanation-callout" role="note">
        <span className="aprova-study-topic-explanation-callout-kicker">Ponto-chave</span>
        <p className="aprova-study-topic-explanation-callout-p">
          <InlineText text={segment.text} />
        </p>
      </aside>
    );
  }
  return null;
}

function TopicExplanationContentComponent({ explanationLoading, topicExplanation, topicTitle = "" }) {
  const sections = parseExplanationSections(explanationLoading ? "" : topicExplanation);
  const a11yHeading =
    topicTitle?.trim() ? (
      <h2 className="aprova-sr-only">Explicação do tópico: {topicTitle.trim()}</h2>
    ) : null;

  if (explanationLoading) {
    return (
      <>
        {a11yHeading}
        <p className="aprova-study-topic-explanation-prose aprova-study-topic-explanation-prose--muted">
          Gerando ou carregando explicação…
        </p>
      </>
    );
  }

  if (sections.length === 0) {
    const fallback = (topicExplanation ?? "").trim();
    if (!fallback) {
      return (
        <>
          {a11yHeading}
          <p className="aprova-study-topic-explanation-prose aprova-study-topic-explanation-prose--muted">
            Ainda não há explicação para este tópico.
          </p>
        </>
      );
    }
    const segments = parseExplanationBodySegments(fallback);
    if (segments.length === 0) {
      return (
        <>
          {a11yHeading}
          <p className="aprova-study-topic-explanation-prose">
            <InlineText text={fallback} />
          </p>
        </>
      );
    }
    return (
      <>
        {a11yHeading}
        <div className="aprova-study-topic-explanation-body">
          {segments.map((seg, j) => (
            <BodySegment key={j} segment={seg} />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {a11yHeading}
      {sections.map((section, i) => {
        const segments = parseExplanationBodySegments(section.body);
        const hasStructure = segments.length > 0;

        return (
          <article
            key={i}
            className={`aprova-study-topic-explanation-section-card${i === 0 ? " aprova-study-topic-explanation-section-card--first" : ""}`}
          >
            {section.title ? (
              <header className="aprova-study-topic-explanation-section-card-head">
                <h4 className="aprova-study-topic-explanation-h">{section.title}</h4>
                {i === 0 ? (
                  <p className="aprova-study-topic-explanation-section-lead">
                    {sections.length > 1
                      ? "A Yara dividiu o conteúdo em seções — leia em blocos, com pausa visual entre ideias."
                      : "Listas, destaques e parágrafos curtos deixam o estudo mais leve — siga o ritmo da leitura."}
                  </p>
                ) : null}
              </header>
            ) : null}
            <div className="aprova-study-topic-explanation-body">
              {hasStructure ? (
                segments.map((seg, j) => <BodySegment key={j} segment={seg} />)
              ) : section.body ? (
                <p className="aprova-study-topic-explanation-para aprova-study-topic-explanation-para--solo">
                  <InlineText text={section.body} />
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </>
  );
}

export const TopicExplanationContent = memo(TopicExplanationContentComponent);

/** Um trecho da explicação (entrega progressiva no chat), reutilizando o mesmo render de listas/callouts. */
export function TopicExplanationChunk({ sectionTitle, body }) {
  const segments = parseExplanationBodySegments(body ?? "");
  const hasStructure = segments.length > 0;
  const b = (body ?? "").trim();

  return (
    <div className="aprova-study-explanation-chunk">
      {sectionTitle ? <h4 className="aprova-study-topic-explanation-h">{sectionTitle}</h4> : null}
      <div className="aprova-study-topic-explanation-body">
        {hasStructure ? (
          segments.map((seg, j) => <BodySegment key={j} segment={seg} />)
        ) : b ? (
          <p className="aprova-study-topic-explanation-para aprova-study-topic-explanation-para--solo">
            <InlineText text={b} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
