import { parseExplanationBodySegments, parseExplanationSections } from "./parseExplanationSections.js";

const MIN_PARTS = 2;
const MAX_PARTS = 4;

/**
 * @param {string} body
 * @returns {string[]}
 */
function splitParagraphBlocks(body) {
  return (body ?? "")
    .split(/\n\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function splitSentencesRough(text) {
  const s = (text ?? "").trim();
  if (!s) return [];
  const chunks = s.split(/(?<=[.!?…])\s+/).filter((x) => x.trim());
  return chunks.length ? chunks : [s];
}

/**
 * Distribui itens em n grupos contíguos (ordem de leitura natural).
 * @template T
 * @param {T[]} items
 * @param {number} n
 * @returns {T[][]}
 */
function distributeIntoN(items, n) {
  if (n <= 0 || !items.length) return [];
  const per = Math.max(1, Math.ceil(items.length / n));
  /** @type {T[][]} */
  const buckets = [];
  for (let b = 0; b < n; b++) {
    const slice = items.slice(b * per, (b + 1) * per);
    if (slice.length) buckets.push(slice);
  }
  return buckets.length ? buckets : [items];
}

/**
 * @param {{ title: string | null, body: string }[]} parts
 * @returns {{ title: string | null, body: string }[]}
 */
function mergeDownToMax(parts, max) {
  const out = parts.map((p) => ({ title: p.title, body: p.body }));
  while (out.length > max) {
    let bestI = 0;
    let best = Infinity;
    for (let i = 0; i < out.length - 1; i++) {
      const score = out[i].body.length + out[i + 1].body.length;
      if (score < best) {
        best = score;
        bestI = i;
      }
    }
    const a = out[bestI];
    const b = out[bestI + 1];
    out.splice(bestI, 2, {
      title: a.title || b.title,
      body: `${a.body}\n\n${b.body}`.trim(),
    });
  }
  return out;
}

/**
 * Corpo único → 2–4 partes por parágrafos ou frases.
 * @param {string | null} title
 * @param {string} body
 */
function splitSingleBody(title, body) {
  const raw = (body ?? "").trim();
  if (!raw) return [];

  const paras = splitParagraphBlocks(raw);
  if (paras.length >= MIN_PARTS) {
    const n = Math.min(MAX_PARTS, Math.max(MIN_PARTS, paras.length));
    const buckets = distributeIntoN(paras, n);
    return buckets.map((b, i) => ({
      title: i === 0 ? title : null,
      body: b.join("\n\n"),
    }));
  }

  if (paras.length === 1) {
    const sentences = splitSentencesRough(paras[0]);
    if (sentences.length >= MIN_PARTS) {
      const n = Math.min(MAX_PARTS, Math.max(MIN_PARTS, sentences.length));
      const buckets = distributeIntoN(sentences, n);
      return buckets.map((b, i) => ({
        title: i === 0 ? title : null,
        body: b.join(" ").trim(),
      }));
    }
    const half = Math.ceil(paras[0].length / 2);
    const a = paras[0].slice(0, half).trim();
    const b = paras[0].slice(half).trim();
    if (b) {
      return [
        { title, body: a },
        { title: null, body: b },
      ];
    }
  }

  const segs = parseExplanationBodySegments(raw);
  if (segs.length >= MIN_PARTS) {
    const n = Math.min(MAX_PARTS, Math.max(MIN_PARTS, segs.length));
    const idxBuckets = distributeIntoN(
      segs.map((_, i) => i),
      n
    );
    return idxBuckets.map((idxs, bi) => {
      const slice = idxs.map((i) => segs[i]);
      const bodyLines = slice
        .map((seg) => {
          if (seg.type === "p") return seg.text ?? "";
          if (seg.type === "callout") return `> ${seg.text ?? ""}`;
          if (seg.type === "list" && seg.items?.length)
            return seg.items.map((item) => `- ${item}`).join("\n");
          return "";
        })
        .filter(Boolean);
      return {
        title: bi === 0 ? title : null,
        body: bodyLines.join("\n\n"),
      };
    });
  }

  return [{ title, body: raw }];
}

/**
 * Transforma o texto da explicação em 2–4 trechos para entrega progressiva no chat.
 * @param {string | null | undefined} topicExplanation
 * @returns {{ id: string, title: string | null, body: string }[]}
 */
export function buildProgressiveExplanationParts(topicExplanation) {
  const raw = (topicExplanation ?? "").trim();
  if (!raw) return [];

  const sections = parseExplanationSections(raw);
  if (sections.length > 1) {
    let parts = sections
      .map((s, i) => ({
        id: `sec-${i}`,
        title: s.title,
        body: (s.body ?? "").trim(),
      }))
      .filter((p) => p.body);

    if (!parts.length) return [];

    parts = mergeDownToMax(
      parts.map((p) => ({ title: p.title, body: p.body })),
      MAX_PARTS
    ).map((p, i) => ({ id: `m-${i}`, title: p.title, body: p.body }));

    if (parts.length === 1) {
      const split = splitSingleBody(parts[0].title, parts[0].body);
      return split.map((p, i) => ({
        id: `p-${i}`,
        title: p.title,
        body: p.body,
      }));
    }

    return parts.map((p, i) => ({ id: `p-${i}`, title: p.title, body: p.body }));
  }

  const only = sections[0] ?? { title: null, body: raw };
  const split = splitSingleBody(only.title, only.body || raw);
  return split.map((p, i) => ({
    id: `p-${i}`,
    title: p.title,
    body: p.body,
  }));
}

/**
 * Assinatura estável para efeitos (evita reagendar timers a cada render).
 * @param {{ id: string, title: string | null, body: string }[]} parts
 */
export function progressivePartsSignature(parts) {
  if (!parts?.length) return "";
  return parts.map((p) => `${p.body.length}`).join(":");
}
