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

  function clearContestSelectionState() {
    setPickedContestId("");
    setCustomContestId("");
    setCustomName("");
    setCustomSubject("");
    setCustomTopic("");
  }

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setContestMode("existing");
    setExamDate("");
    setHours("2");
    clearContestSelectionState();
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
      title: "Qual prova merece o nosso foco primeiro?",
      helper: "Escolha do catálogo ou crie um concurso personalizado. Eu limpo o caminho para a gente começar sem bagunça.",
    },
    {
      id: "examDate",
      icon: CalendarDays,
      title: "Se já existir uma data, eu ajusto seu ritmo com mais precisão.",
      helper: "Se isso ainda estiver em aberto, sem problema. Eu consigo montar seu começo mesmo assim.",
    },
    {
      id: "hours",
      icon: Clock3,
      title: "Quanto tempo cabe de verdade na sua rotina?",
      helper: "Prefiro te entregar consistência real, não uma meta bonita que morre em dois dias.",
    },
    {
      id: "level",
      icon: GraduationCap,
      title: "Hoje, em que ponto da jornada você se sente?",
      helper: "Com isso eu calibro profundidade, ritmo e o quanto te puxo em cada etapa.",
    },
    {
      id: "difficulties",
      icon: ChartNoAxesColumn,
      title: "O que mais costuma te travar quando você estuda?",
      helper: "Pode ser matéria, tema, cansaço, leitura ou padrão de erro. Poucas palavras já bastam.",
    },
    {
      id: "explanation",
      icon: Sparkles,
      title: "Qual jeito de explicar faz você render mais?",
      helper: "Eu ajusto a voz, a profundidade e o ritmo para a explicação encaixar melhor em você.",
    },
    {
      id: "move",
      icon: BookOpen,
      title: "Quando bate dúvida, o que costuma te destravar primeiro?",
      helper: "Isso organiza a ordem entre teoria, exemplo, contraste e prática dentro do seu plano.",
    },
    {
      id: "focus",
      icon: Brain,
      title: "Para começar forte, onde você quer sentir evolução primeiro?",
      helper: "Esse foco entra no seu perfil e guia o tom do seu plano inicial com a Yara.",
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
    maxWidth: 1180,
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
  const progressPct = ((step + 1) / steps.length) * 100;

  function switchToExistingContestMode() {
    setContestMode("existing");
    clearContestSelectionState();
    setLocalError("");
  }

  function switchToCustomContestMode() {
    setContestMode("custom");
    clearContestSelectionState();
    setLocalError("");
  }

  return (
    <div className="aprova-onboarding-overlay" style={overlay} role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="aprova-onboarding-shell" style={panel}>
        <aside className="aprova-onboarding-side">
          <div className="aprova-onboarding-badge">
            <Sparkles size={14} />
            Yara está desenhando seu começo
          </div>

          <div className="aprova-onboarding-hero">
            <h2 id="onb-title">Eu vou montar seu começo com você.</h2>
            <p>
              Me responde em passos rápidos e eu transformo isso em um plano claro, no seu ritmo e
              com foco no que realmente vai cair.
            </p>
          </div>

          <div className="aprova-onboarding-progress-card">
            <div className="aprova-onboarding-progress-head">
              <div>
                <span className="aprova-onboarding-progress-label">Etapa atual</span>
                <strong>
                  {step + 1} de {steps.length}
                </strong>
              </div>
              <span className="aprova-onboarding-progress-value">{Math.round(progressPct)}%</span>
            </div>
            <div className="aprova-onboarding-progress-track">
              <span className="aprova-onboarding-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="aprova-onboarding-step-list">
              {steps.map((item, index) => {
                const active = index === step;
                const done = index < step;
                return (
                  <div
                    key={item.id}
                    className={`aprova-onboarding-step-item ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
                  >
                    <span className="aprova-onboarding-step-bullet">
                      {done ? <CircleCheckBig size={13} /> : index + 1}
                    </span>
                    <span>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="aprova-onboarding-side-note">
            <strong>Seu plano já começa com contexto.</strong>
            <p>
              O que você responder aqui vira direção prática para a Yara puxar seu estudo do jeito
              certo desde o início.
            </p>
          </div>

          {answerPreview.length ? (
            <div className="aprova-onboarding-preview-card">
              <span className="aprova-onboarding-preview-title">O que a Yara já entendeu</span>
              <div className="aprova-onboarding-preview-chips">
                {answerPreview.map((item) => (
                  <div key={item.label} className="aprova-onboarding-preview-chip">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="aprova-onboarding-main">
          <div className="aprova-onboarding-question-card">
            <div className="aprova-onboarding-question-head">
              <div className="aprova-onboarding-question-icon">
                <CurrentIcon size={18} />
              </div>
              <div>
                <span className="aprova-onboarding-question-eyebrow">Pergunta da Yara</span>
                <h3>{currentStep.title}</h3>
                <p>{currentStep.helper}</p>
              </div>
            </div>

            {currentStep.id === "contest" ? (
              <div className="aprova-onboarding-stack">
                <div className="aprova-onboarding-segment">
                  <button
                    type="button"
                    className={`aprova-onboarding-segment-btn ${contestMode === "existing" ? "active" : ""}`}
                    onClick={switchToExistingContestMode}
                  >
                    Escolher do catálogo
                  </button>
                  <button
                    type="button"
                    className={`aprova-onboarding-segment-btn ${contestMode === "custom" ? "active" : ""}`}
                    onClick={switchToCustomContestMode}
                  >
                    Criar concurso personalizado
                  </button>
                </div>

                {contestMode === "existing" ? (
                  <label className="aprova-onboarding-input-wrap">
                    <span>Escolha sua prova</span>
                    <select
                      value={pickedContestId}
                      onChange={(e) => setPickedContestId(e.target.value)}
                      style={styles.profileInput}
                      className="aprova-onboarding-input"
                    >
                      <option value="">Escolha uma prova do catálogo...</option>
                      {contests.map((contest) => (
                        <option key={contest.id} value={contest.id} style={styles.optionDark}>
                          {contest.name}
                          {contest.owner_user_id ? " (seu)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="aprova-onboarding-stack">
                    <div className="aprova-onboarding-mini-callout">
                      Se sua prova não estiver no catálogo, eu crio esse ponto de partida com você
                      agora.
                    </div>
                    <label className="aprova-onboarding-input-wrap">
                      <span>Nome da prova ou concurso</span>
                      <input
                        placeholder="Ex.: TJ-SP, INSS ou concurso da sua cidade"
                        value={customName}
                        onChange={(e) => {
                          setCustomContestId("");
                          setCustomName(e.target.value);
                        }}
                        style={styles.profileInput}
                        className="aprova-onboarding-input"
                      />
                    </label>
                    <label className="aprova-onboarding-input-wrap">
                      <span>Primeira matéria (opcional)</span>
                      <input
                        placeholder="Ex.: Constitucional"
                        value={customSubject}
                        onChange={(e) => {
                          setCustomContestId("");
                          setCustomSubject(e.target.value);
                        }}
                        style={styles.profileInput}
                        className="aprova-onboarding-input"
                      />
                    </label>
                    <label className="aprova-onboarding-input-wrap">
                      <span>Primeiro tópico (opcional)</span>
                      <input
                        placeholder="Ex.: Controle de constitucionalidade"
                        value={customTopic}
                        onChange={(e) => {
                          setCustomContestId("");
                          setCustomTopic(e.target.value);
                        }}
                        style={styles.profileInput}
                        className="aprova-onboarding-input"
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : null}

            {currentStep.id === "examDate" ? (
              <label className="aprova-onboarding-input-wrap">
                <span>Se já souber, me passa a data</span>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  style={styles.profileInput}
                  className="aprova-onboarding-input"
                />
              </label>
            ) : null}

            {currentStep.id === "hours" ? (
              <div className="aprova-onboarding-choice-grid aprova-onboarding-choice-grid--compact">
                {["1h", "2h", "3h", "4h+"].map((label) => {
                  const value = label.replace("h", "");
                  const active = hours === value;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setHours(value)}
                      className={`aprova-onboarding-choice-card ${active ? "active" : ""}`}
                    >
                      <strong>{label}</strong>
                      <span>{label === "1h" ? "ritmo leve" : label === "2h" ? "base consistente" : label === "3h" ? "ritmo forte" : "imersão total"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {currentStep.id === "level" ? (
              <div className="aprova-onboarding-choice-grid">
                {levelOptions.map((option) => {
                  const active = currentLevel === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCurrentLevel(option.value)}
                      className={`aprova-onboarding-choice-card aprova-onboarding-choice-card--left ${active ? "active" : ""}`}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {currentStep.id === "difficulties" ? (
              <label className="aprova-onboarding-input-wrap">
                <span>Escreva do jeito mais natural possível</span>
                <textarea
                  value={difficultiesText}
                  onChange={(e) => setDifficultiesText(e.target.value)}
                  placeholder="Ex.: interpretação de texto, constitucional, leitura rápida de enunciado"
                  style={{
                    ...styles.profileInput,
                    minHeight: 120,
                    resize: "vertical",
                    fontFamily: styles.page.fontFamily,
                  }}
                  className="aprova-onboarding-input aprova-onboarding-textarea"
                />
              </label>
            ) : null}

            {currentStep.id === "explanation" ? (
              <div className="aprova-onboarding-choice-grid">
                {explanationOptions.map((option) => {
                  const active = explanationPreference === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExplanationPreference(option.value)}
                      className={`aprova-onboarding-choice-card aprova-onboarding-choice-card--left ${active ? "active" : ""}`}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {currentStep.id === "move" ? (
              <div className="aprova-onboarding-choice-grid">
                {moveOptions.map((option) => {
                  const active = preferredStudyMove === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPreferredStudyMove(option.value)}
                      className={`aprova-onboarding-choice-card aprova-onboarding-choice-card--left ${active ? "active" : ""}`}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {currentStep.id === "focus" ? (
              <div className="aprova-onboarding-choice-grid">
                {focusOptions.map((option) => {
                  const active = initialFocus === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setInitialFocus(option.value)}
                      className={`aprova-onboarding-choice-card aprova-onboarding-choice-card--left ${active ? "active" : ""}`}
                    >
                      <strong>{option.value}</strong>
                      <span>{option.helper}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {localError ? <p style={{ ...styles.errorText, margin: "14px 0 0 0" }}>{localError}</p> : null}

          <div className="aprova-onboarding-actions">
            <div className="aprova-onboarding-actions-left">
              {step > 0 ? (
                <button
                  type="button"
                  style={styles.cancelButton}
                  className="aprova-onboarding-secondary-button"
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
                  className="aprova-onboarding-secondary-button"
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
            </div>

            <button
              type="button"
              className="aprova-onboarding-primary-button"
              disabled={busy}
              onClick={() => void handleNext()}
            >
              {busy ? "Salvando..." : isLastStep ? "Fechar meu plano inicial" : "Continuar"}
              {!busy ? <ArrowRight size={16} /> : null}
            </button>
          </div>

          <div className="aprova-onboarding-footnote">
            <CircleCheckBig size={18} color="#86efac" style={{ marginTop: 1, flexShrink: 0 }} />
            <p>
              Você pode ajustar tudo depois. Aqui eu só estou pegando o essencial para te entregar
              um começo mais inteligente sem travar sua entrada.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export const OnboardingModal = memo(OnboardingModalComponent);
