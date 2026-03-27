import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  ChartNoAxesColumn,
  CircleCheckBig,
  Clock3,
  GraduationCap,
  Sparkles,
  Target,
} from "lucide-react";
import { styles } from "../styles/appStyles.js";

const levelOptions = [
  { value: "iniciante", label: "Iniciante", helper: "Ainda estou montando base" },
  { value: "intermediario", label: "Intermediário", helper: "Já vi parte do conteúdo" },
  { value: "avancado", label: "Avançado", helper: "Quero afinar detalhes e performance" },
];

const explanationOptions = [
  { value: "direta", label: "Mais direta", helper: "sem rodeio, indo ao ponto" },
  { value: "detalhada", label: "Mais detalhada", helper: "com mais contexto e calma" },
  { value: "analogias", label: "Com analogias", helper: "ligando com exemplos do dia a dia" },
  { value: "passo_a_passo", label: "Passo a passo", helper: "quebrando em partes pequenas" },
];

const moveOptions = [
  { value: "theory", label: "Teoria", helper: "quero base antes de praticar" },
  { value: "example", label: "Exemplo", helper: "aprendo vendo aplicação concreta" },
  { value: "contrast", label: "Contraste", helper: "entendo melhor comparando pegadinhas" },
  { value: "practice", label: "Prática", helper: "prefiro fixar resolvendo" },
];

const focusOptions = [
  { value: "Montar uma base forte", helper: "organizar a largada com clareza" },
  { value: "Destravar meus pontos fracos", helper: "atacar o que mais trava" },
  { value: "Ganhar consistência na rotina", helper: "criar ritmo sem sobrecarga" },
  { value: "Fazer mais questões com sentido", helper: "praticar sem estudar no escuro" },
];

function parseDifficultyList(text) {
  return text
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function OnboardingModalComponent({ open, user, contests, studyApi, onFinished }) {
  const [step, setStep] = useState(0);
  const [contestMode, setContestMode] = useState("existing");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState("2");
  const [pickedContestId, setPickedContestId] = useState("");
  const [customContestId, setCustomContestId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [currentLevel, setCurrentLevel] = useState("");
  const [difficultiesText, setDifficultiesText] = useState("");
  const [explanationPreference, setExplanationPreference] = useState("");
  const [preferredStudyMove, setPreferredStudyMove] = useState("");
  const [initialFocus, setInitialFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setContestMode("existing");
    setExamDate("");
    setHours("2");
    setPickedContestId("");
    setCustomContestId("");
    setCustomName("");
    setCustomSubject("");
    setCustomTopic("");
    setCurrentLevel("");
    setDifficultiesText("");
    setExplanationPreference("");
    setPreferredStudyMove("");
    setInitialFocus("");
    setBusy(false);
    setLocalError("");
  }, [open]);

  const contestLabel = useMemo(() => {
    if (contestMode === "custom") return customName.trim();
    const found = contests.find((item) => item.id === pickedContestId);
    return found?.name?.trim() || "";
  }, [contestMode, contests, customName, pickedContestId]);

  const difficultiesList = useMemo(() => parseDifficultyList(difficultiesText), [difficultiesText]);

  const answerPreview = [
    contestLabel ? { label: "Prova alvo", value: contestLabel } : null,
    examDate ? { label: "Data", value: examDate } : null,
    hours ? { label: "Rotina", value: `${hours} por dia` } : null,
    currentLevel ? { label: "Nível", value: currentLevel } : null,
    difficultiesList.length ? { label: "Dificuldades", value: difficultiesList.join(", ") } : null,
    explanationPreference ? { label: "Explicação", value: explanationPreference } : null,
    preferredStudyMove ? { label: "Preferência", value: preferredStudyMove } : null,
    initialFocus ? { label: "Foco inicial", value: initialFocus } : null,
  ].filter(Boolean);

  const steps = [
    {
      id: "contest",
      icon: Target,
      title: "Para qual prova ou concurso eu vou te puxar primeiro?",
      helper: "Você pode escolher algo do catálogo ou criar um concurso personalizado.",
    },
    {
      id: "examDate",
      icon: CalendarDays,
      title: "Se você já souber a data da prova, eu calibro sua urgência melhor.",
      helper: "Se ainda não tiver certeza, tudo bem pular por enquanto.",
    },
    {
      id: "hours",
      icon: Clock3,
      title: "Quanto tempo por dia cabe de verdade na sua rotina?",
      helper: "Prefiro um plano realista a uma meta bonita que não encaixa.",
    },
    {
      id: "level",
      icon: GraduationCap,
      title: "Em que ponto você sente que está hoje?",
      helper: "Isso me ajuda a decidir se começo da base ou se acelero mais.",
    },
    {
      id: "difficulties",
      icon: ChartNoAxesColumn,
      title: "Quais pontos mais costumam te travar?",
      helper: "Pode citar matérias, temas ou padrões de erro. Se quiser, escreva em poucas palavras.",
    },
    {
      id: "explanation",
      icon: Sparkles,
      title: "Como você gosta que a Yara explique?",
      helper: "Eu adapto o tom e a profundidade das explicações.",
    },
    {
      id: "move",
      icon: BookOpen,
      title: "Quando surge uma dúvida, o que te ajuda mais primeiro?",
      helper: "Isso ajusta a ordem entre teoria, exemplo, contraste e prática.",
    },
    {
      id: "focus",
      icon: Brain,
      title: "Perfeito. E qual deve ser o nosso foco logo no começo?",
      helper: "Esse foco aparece no seu perfil e puxa o tom do plano inicial.",
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  if (!open || !user) return null;

  async function handleCreateCustom() {
    setLocalError("");
    if (!customName.trim()) {
      setLocalError("Digite um nome para o concurso.");
      return;
    }
    setBusy(true);
    try {
      const { data: row, error } = await studyApi.createUserContest(customName.trim());
      if (error) throw error;
      if (!row?.id) throw new Error("Não foi possível criar o concurso.");
      let contestId = row.id;
      if (customSubject.trim()) {
        const { data: sub, error: se } = await studyApi.addSubjectToContest(contestId, customSubject.trim());
        if (se) throw se;
        if (customTopic.trim() && sub?.id) {
          const { error: te } = await studyApi.addTopicToSubject(sub.id, customTopic.trim(), "");
          if (te) throw te;
        }
      }
      await studyApi.reloadContests();
      setCustomContestId(contestId);
      return { id: contestId, label: customName.trim() };
    } catch (e) {
      setLocalError(e.message || "Erro ao criar concurso.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function ensureContestSelection() {
    setLocalError("");
    if (contestMode === "custom") {
      if (customContestId) {
        return { id: customContestId, label: contestLabel || customName.trim() };
      }
      return handleCreateCustom();
    }
    if (!pickedContestId) {
      setLocalError("Escolha um concurso do catálogo ou crie um personalizado.");
      return null;
    }
    const found = contests.find((item) => item.id === pickedContestId);
    return { id: pickedContestId, label: found?.name?.trim() || "" };
  }

  async function handleFinish() {
    setLocalError("");
    const contest = await ensureContestSelection();
    if (!contest?.id) {
      return;
    }
    setBusy(true);
    try {
      await onFinished({
        mainExamId: contest.id,
        contestLabel: contest.label,
        examDate,
        hoursPerDay: Number.parseInt(hours, 10) || 2,
        currentLevel,
        biggestDifficulties: difficultiesList,
        explanationPreference,
        preferredStudyMove,
        initialFocus,
        goalLabel: initialFocus || "Plano inicial com a Yara",
      });
    } catch (e) {
      setLocalError(e.message || "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    setLocalError("");

    if (currentStep.id === "contest") {
      const contest = await ensureContestSelection();
      if (!contest?.id) return;
    }

    if (currentStep.id === "hours" && !hours) {
      setLocalError("Escolha um ritmo diário para eu montar um começo realista.");
      return;
    }

    if (currentStep.id === "level" && !currentLevel) {
      setLocalError("Escolha como você se percebe hoje para eu calibrar a profundidade.");
      return;
    }

    if (!isLastStep) {
      setStep((value) => value + 1);
      return;
    }

    await handleFinish();
  }

  const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
  };

  const panel = {
    width: "100%",
    maxWidth: 760,
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(20,20,30,0.98), rgba(12,12,18,0.98) 62%, rgba(8,8,12,0.99) 100%)",
    padding: 28,
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 30px 120px rgba(0,0,0,0.52), 0 0 0 1px rgba(196,181,253,0.05)",
  };

  const CurrentIcon = currentStep.icon;
  const canSkip = ["examDate", "difficulties", "explanation", "move", "focus"].includes(currentStep.id);

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div style={panel}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(196,181,253,0.18)",
                background: "rgba(139,92,246,0.12)",
                color: "#ede9fe",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <Sparkles size={14} />
              Yara está montando seu início
            </div>
            <h2 id="onb-title" style={{ ...styles.sectionTitle, marginTop: 14, marginBottom: 0 }}>
              Onboarding guiado, sem formulário frio
            </h2>
            <p style={{ ...styles.sectionText, marginTop: 8, marginBottom: 0, maxWidth: 560 }}>
              Vou te conhecer em passos curtos e usar isso para calibrar concurso, ritmo e o jeito de explicar.
            </p>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              minWidth: 132,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Etapa
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: 18, fontWeight: 800, color: "#fafafa" }}>
              {step + 1} / {steps.length}
            </p>
          </div>
        </div>

        {answerPreview.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {answerPreview.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.09)",
                  background: "rgba(255,255,255,0.05)",
                  maxWidth: "100%",
                }}
              >
                <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 800 }}>{item.label}: </span>
                <span style={{ fontSize: 12, color: "#e4e4e7" }}>{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 16,
            padding: "18px 18px 20px",
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                background: "rgba(139,92,246,0.16)",
                color: "#e9d5ff",
                flexShrink: 0,
              }}
            >
              <CurrentIcon size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: "#a78bfa", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Yara
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: 18, fontWeight: 800, color: "#fafafa", lineHeight: 1.4 }}>
                {currentStep.title}
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "#b4b4bf", lineHeight: 1.7 }}>
                {currentStep.helper}
              </p>
            </div>
          </div>

          {currentStep.id === "contest" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{
                    ...styles.cancelButton,
                    borderRadius: 999,
                    ...(contestMode === "existing"
                      ? {
                          border: "1px solid rgba(168,85,247,0.5)",
                          background: "rgba(168,85,247,0.14)",
                          color: "#faf5ff",
                        }
                      : {}),
                  }}
                  onClick={() => {
                    setContestMode("existing");
                    setCustomContestId("");
                  }}
                >
                  Escolher do catálogo
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.cancelButton,
                    borderRadius: 999,
                    ...(contestMode === "custom"
                      ? {
                          border: "1px solid rgba(168,85,247,0.5)",
                          background: "rgba(168,85,247,0.14)",
                          color: "#faf5ff",
                        }
                      : {}),
                  }}
                  onClick={() => {
                    setContestMode("custom");
                    setPickedContestId("");
                  }}
                >
                  Criar um concurso meu
                </button>
              </div>

              {contestMode === "existing" ? (
                <select
                  value={pickedContestId}
                  onChange={(e) => setPickedContestId(e.target.value)}
                  style={styles.profileInput}
                >
                  <option value="">Selecione um concurso existente…</option>
                  {contests.map((contest) => (
                    <option key={contest.id} value={contest.id} style={styles.optionDark}>
                      {contest.name}
                      {contest.owner_user_id ? " (seu)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    placeholder="Nome da prova ou concurso"
                    value={customName}
                    onChange={(e) => {
                      setCustomContestId("");
                      setCustomName(e.target.value);
                    }}
                    style={styles.profileInput}
                  />
                  <input
                    placeholder="Primeira matéria (opcional)"
                    value={customSubject}
                    onChange={(e) => {
                      setCustomContestId("");
                      setCustomSubject(e.target.value);
                    }}
                    style={styles.profileInput}
                  />
                  <input
                    placeholder="Primeiro tópico (opcional)"
                    value={customTopic}
                    onChange={(e) => {
                      setCustomContestId("");
                      setCustomTopic(e.target.value);
                    }}
                    style={styles.profileInput}
                  />
                </div>
              )}
            </div>
          ) : null}

          {currentStep.id === "examDate" ? (
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              style={styles.profileInput}
            />
          ) : null}

          {currentStep.id === "hours" ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["1h", "2h", "3h", "4h+"].map((label) => {
                const value = label.replace("h", "");
                const active = hours === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHours(value)}
                    style={{
                      minWidth: 96,
                      padding: "14px 16px",
                      borderRadius: 16,
                      border: active
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.04)",
                      color: active ? "#faf5ff" : "#e4e4e7",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep.id === "level" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {levelOptions.map((option) => {
                const active = currentLevel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCurrentLevel(option.value)}
                    style={{
                      textAlign: "left",
                      padding: "15px 16px",
                      borderRadius: 18,
                      border: active
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.04)",
                      color: "#f4f4f5",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{option.label}</p>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#b4b4bf", lineHeight: 1.5 }}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep.id === "difficulties" ? (
            <textarea
              value={difficultiesText}
              onChange={(e) => setDifficultiesText(e.target.value)}
              placeholder="Ex.: interpretação de texto, constitucional, leitura rápida de enunciado"
              style={{
                ...styles.profileInput,
                minHeight: 110,
                resize: "vertical",
                fontFamily: styles.page.fontFamily,
              }}
            />
          ) : null}

          {currentStep.id === "explanation" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {explanationOptions.map((option) => {
                const active = explanationPreference === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExplanationPreference(option.value)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: active
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.04)",
                      color: "#f4f4f5",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{option.label}</p>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#b4b4bf", lineHeight: 1.5 }}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep.id === "move" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {moveOptions.map((option) => {
                const active = preferredStudyMove === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreferredStudyMove(option.value)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: active
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.04)",
                      color: "#f4f4f5",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{option.label}</p>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#b4b4bf", lineHeight: 1.5 }}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep.id === "focus" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {focusOptions.map((option) => {
                const active = initialFocus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setInitialFocus(option.value)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: active
                        ? "1px solid rgba(168,85,247,0.5)"
                        : "1px solid rgba(255,255,255,0.1)",
                      background: active ? "rgba(168,85,247,0.14)" : "rgba(255,255,255,0.04)",
                      color: "#f4f4f5",
                      cursor: "pointer",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{option.value}</p>
                    <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#b4b4bf", lineHeight: 1.5 }}>
                      {option.helper}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {localError ? <p style={{ ...styles.errorText, marginBottom: 12 }}>{localError}</p> : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          {step > 0 ? (
            <button
              type="button"
              style={styles.cancelButton}
              disabled={busy}
              onClick={() => setStep((value) => value - 1)}
            >
              Voltar
            </button>
          ) : null}
          {canSkip ? (
            <button
              type="button"
              style={styles.cancelButton}
              disabled={busy}
              onClick={() => {
                setLocalError("");
                if (!isLastStep) {
                  setStep((value) => value + 1);
                } else {
                  void handleFinish();
                }
              }}
            >
              Pular por enquanto
            </button>
          ) : null}
          <button
            type="button"
            style={{
              ...styles.primaryOnlyButton,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "linear-gradient(135deg, #f5f3ff 0%, #e9d5ff 45%, #ddd6fe 100%)",
              boxShadow: "0 12px 36px rgba(139,92,246,0.22)",
            }}
            disabled={busy}
            onClick={() => void handleNext()}
          >
            {busy ? "Salvando…" : isLastStep ? "Concluir com a Yara" : "Continuar"}
            {!busy ? <ArrowRight size={16} /> : null}
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "14px 16px",
            borderRadius: 18,
            border: "1px solid rgba(74,222,128,0.16)",
            background: "rgba(22,163,74,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CircleCheckBig size={18} color="#86efac" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: "#d1fae5", lineHeight: 1.65 }}>
              Você pode ajustar essas preferências depois. O objetivo aqui é só dar para a Yara um ponto de partida
              melhor, sem travar sua entrada no app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const OnboardingModal = memo(OnboardingModalComponent);
