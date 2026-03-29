const monthLabels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function getContestStatusLabel(status) {
  if (status === "confirmed") return "confirmado";
  if (status === "expected") return "previsto";
  return "planejado";
}

export function normalizeContestArea(area = "") {
  const normalized = String(area).trim().toLowerCase();
  if (!normalized) return "geral";
  if (["administrativa", "policial", "tribunais", "controle", "fiscal", "educacao", "bancaria"].includes(normalized)) {
    return normalized;
  }
  return "geral";
}

export function getContestForecastLabel(entry) {
  const monthIndex = Number(entry?.predicted_month) - 1;
  const monthLabel = monthLabels[monthIndex] || "";
  if (!entry?.predicted_year) return "";
  if (!monthLabel) return `${entry.predicted_year}`;
  return `${monthLabel}/${entry.predicted_year}`;
}

export function inferContestAreaBucket(name = "") {
  const normalized = String(name).toLowerCase();

  if (/(prf|pf|policia|polícia|penal|delegado|escriv[aã]o|agente)/.test(normalized)) return "policial";
  if (/(tj|trf|tre|trt|tribunal|mp|defensoria)/.test(normalized)) return "tribunais";
  if (/(receita|sefaz|fiscal|auditor)/.test(normalized)) return "fiscal";
  if (/(banco do brasil|caixa|banco|banc[aá]ri)/.test(normalized)) return "bancaria";
  if (/(inss|administrativo|prefeitura|camara|câmara|municipal)/.test(normalized)) return "administrativa";
  if (/(tcu|cgm|cge|controle)/.test(normalized)) return "controle";

  return "geral";
}
