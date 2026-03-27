/**
 * Divide texto com cabeçalhos ## em blocos para exibição.
 * Compatível com explicações antigas sem marcadores (retorna um único bloco).
 */
export function parseExplanationSections(text) {
  const raw = (text ?? "").trim();
  if (!raw) return [];

  if (!/^##\s/m.test(raw)) {
    return [{ title: null, body: raw }];
  }

  const lines = raw.split(/\n/);
  /** @type {{ title: string | null, lines: string[] }[]} */
  const blocks = [];
  let current = { title: null, lines: [] };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) {
      if (current.title || current.lines.length) {
        blocks.push(current);
      }
      current = { title: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  blocks.push(current);

  return blocks.map((b) => ({
    title: b.title,
    body: b.lines.join("\n").trim(),
  }));
}

/**
 * Divide trechos **negrito** para renderização segura (sem HTML cru).
 * @param {string} text
 * @returns {{ strong: boolean, text: string }[]}
 */
export function splitInlineEmphasis(text) {
  const s = text ?? "";
  if (!s) return [{ strong: false, text: "" }];
  const parts = [];
  const re = /\*\*([\s\S]*?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ strong: false, text: s.slice(last, m.index) });
    parts.push({ strong: true, text: m[1] });
    last = m.lastIndex;
  }
  if (last < s.length) parts.push({ strong: false, text: s.slice(last) });
  return parts.length ? parts : [{ strong: false, text: s }];
}

/**
 * Segmenta o corpo de uma seção: parágrafos, listas (- * •) e callouts (> ).
 * @param {string} body
 * @returns {{ type: 'p' | 'list' | 'callout', text?: string, items?: string[] }[]}
 */
export function parseExplanationBodySegments(body) {
  const raw = (body ?? "").trim();
  if (!raw) return [];

  const lines = raw.split("\n");
  /** @type {{ type: 'p' | 'list' | 'callout', text?: string, items?: string[] }[]} */
  const segments = [];
  let i = 0;

  const skipBlanks = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };

  skipBlanks();
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*[-*•]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, "").trim());
        i++;
      }
      if (items.length) segments.push({ type: "list", items });
      skipBlanks();
      continue;
    }
    if (/^>\s?/.test(line)) {
      const parts = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, "").trim());
        i++;
      }
      const text = parts.join("\n").trim();
      if (text) segments.push({ type: "callout", text });
      skipBlanks();
      continue;
    }
    if (line.trim() === "") {
      i++;
      skipBlanks();
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*•]\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    const text = para.join("\n").trim();
    if (text) segments.push({ type: "p", text });
    skipBlanks();
  }
  return segments;
}
