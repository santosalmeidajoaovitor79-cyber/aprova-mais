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
import {
  getContestForecastLabel,
  getContestStatusLabel,
  inferContestAreaBucket,
} from "../data/contestCatalog.js";

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
  const [contestSearch, setContestSearch] = useState("");
  const [catalogContests, setCatalogContests] = useState([]);
  const [catalogSuggestions, setCatalogSuggestions] = useState([]);
  const [catalogSearchResults, setCatalogSearchResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearchLoading, setCatalogSearchLoading] = useState(false);
  const [catalogTreePreview, setCatalogTreePreview] = useState([]);
  const [catalogTreeLoading, setCatalogTreeLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
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
  const [resolvedContestSelection, setResolvedContestSelection] = useState(null);

  function clearContestSelectionState() {
    setPickedContestId("");
    setCustomContestId("");
    setCustomName("");
    setCustomSubject("");
    setCustomTopic("");
    setResolvedContestSelection(null);
  }

  function clearCustomContestDraft() {
    setCustomContestId("");
    setCustomName("");
    setCustomSubject("");
    setCustomTopic("");
  }

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setContestMode("existing");
    setContestSearch("");
    setCatalogContests([]);
    setCatalogSuggestions([]);
    setCatalogSearchResults([]);
    setCatalogTreePreview([]);
    setCatalogError("");
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

  const selectedExistingContest = useMemo(
    () => contests.find((item) => item.id === pickedContestId) || null,
    [contests, pickedContestId]
  );

  const catalogContestPool = useMemo(() => {
    const merged = [];
    const seen = new Set();

    [catalogContests, catalogSuggestions, catalogSearchResults].forEach((group) => {
      group.forEach((item) => {
        if (!item?.id || seen.has(item.id)) return;
        seen.add(item.id);
        merged.push(item);
      });
    });

    return merged;
  }, [catalogContests, catalogSearchResults, catalogSuggestions]);

  const selectedCatalogContest = useMemo(
    () => catalogContestPool.find((item) => item.id === pickedContestId) || null,
    [catalogContestPool, pickedContestId]
  );

  const contestLabel = useMemo(() => {
    if (contestMode === "custom") return customName.trim();
    if (selectedExistingContest?.name?.trim()) return selectedExistingContest.name.trim();
    if (resolvedContestSelection?.catalogId === pickedContestId) return resolvedContestSelection.label;
    return selectedCatalogContest?.name?.trim() || "";
  }, [contestMode, customName, pickedContestId, resolvedContestSelection, selectedCatalogContest, selectedExistingContest]);

  const preferredAreaBucket = useMemo(() => {
    const metadataContestLabel = user?.user_metadata?.yara_profile?.contestLabel ?? "";
    const sources = [metadataContestLabel, ...contests.map((item) => item?.name ?? "")];

    for (const source of sources) {
      const bucket = inferContestAreaBucket(source);
      if (bucket !== "geral") return bucket;
    }

    return "geral";
  }, [contests, user]);

  const preferredAreaLabel =
    preferredAreaBucket === "policial"
      ? "carreira policial"
      : preferredAreaBucket === "tribunais"
        ? "tribunais"
        : preferredAreaBucket === "fiscal"
          ? "area fiscal"
          : preferredAreaBucket === "bancaria"
            ? "area bancaria"
          : preferredAreaBucket === "administrativa"
            ? "area administrativa"
            : preferredAreaBucket === "controle"
              ? "controle"
              : preferredAreaBucket === "educacao"
                ? "educacao"
              : "";

  const catalogStructureSummary = useMemo(() => {
    const subjectMap = new Map();
    for (const row of catalogTreePreview) {
      if (!row?.subject_id) continue;
      if (!subjectMap.has(row.subject_id)) {
        subjectMap.set(row.subject_id, {
          id: row.subject_id,
          name: row.subject_name,
          weight: row.subject_weight ?? null,
          topicNames: [],
        });
      }
      if (row.topic_name) {
        subjectMap.get(row.subject_id).topicNames.push(row.topic_name);
      }
    }
    return [...subjectMap.values()];
  }, [catalogTreePreview]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");

      const { data, error } = await studyApi.fetchContestsCatalog();
      if (cancelled) return;

      if (error) {
        setCatalogError(error.message || "Nao consegui carregar o catalogo agora.");
        setCatalogContests([]);
      } else {
        setCatalogError("");
        setCatalogContests(data ?? []);
      }

      setCatalogLoading(false);
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [open, studyApi]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadSuggestions() {
      const { data, error } = await studyApi.getSuggestedContests(preferredAreaBucket);
      if (cancelled) return;

      if (error) {
        setCatalogSuggestions([]);
        setCatalogError((prev) => prev || error.message || "Nao consegui carregar sugestoes agora.");
      } else {
        setCatalogError("");
        setCatalogSuggestions((data ?? []).slice(0, 3));
      }
    }

    loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [open, preferredAreaBucket, studyApi]);

  useEffect(() => {
    if (!open) return;

    const term = contestSearch.trim();
    if (!term) {
      setCatalogSearchResults([]);
      setCatalogSearchLoading(false);
      return;
    }

    let cancelled = false;

    async function runSearch() {
      setCatalogSearchLoading(true);
      const { data, error } = await studyApi.searchContests(term);
      if (cancelled) return;

      if (error) {
        setCatalogSearchResults([]);
        setCatalogError((prev) => prev || error.message || "Nao consegui buscar concursos agora.");
      } else {
        setCatalogError("");
        setCatalogSearchResults(data ?? []);
      }

      setCatalogSearchLoading(false);
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [contestSearch, open, studyApi]);

  useEffect(() => {
    if (!open || contestMode !== "existing" || !selectedCatalogContest?.id) {
      setCatalogTreePreview([]);
      setCatalogTreeLoading(false);
      return;
    }

    let cancelled = false;

    async function loadTreePreview() {
      setCatalogTreeLoading(true);
      const { data, error } = await studyApi.fetchPublicContestCatalogTree(selectedCatalogContest.id);
      if (cancelled) return;

      if (error) {
        setCatalogTreePreview([]);
        setCatalogError((prev) => prev || error.message || "Nao consegui carregar a arvore desse concurso.");
      } else {
        setCatalogTreePreview(data ?? []);
      }

      setCatalogTreeLoading(false);
    }

    loadTreePreview();

    return () => {
      cancelled = true;
    };
  }, [contestMode, open, selectedCatalogContest?.id, studyApi]);

  const difficultiesList = useMemo(() => parseDifficultyList(difficultiesText), [difficultiesText]);

  const selectedLevelLabel = levelOptions.find((option) => option.value === currentLevel)?.label || "";
  const selectedExplanationLabel =
    explanationOptions.find((option) => option.value === explanationPreference)?.label || "";
  const selectedMoveLabel = moveOptions.find((option) => option.value === preferredStudyMove)?.label || "";
  const selectedFocusLabel = focusOptions.find((option) => option.value === initialFocus)?.value || "";
  const contestSelectionGuidance = useMemo(() => {
    if (contestMode === "custom" && customName.trim()) {
      return "Perfeito. Mesmo fora do catalogo, eu consigo montar um ponto de partida coerente para voce.";
    }

    if (selectedCatalogContest?.status === "confirmed") {
      return "Esse concurso esta mais proximo. Vamos focar em ganho rapido.";
    }

    if (selectedCatalogContest?.status === "planned" || selectedCatalogContest?.status === "expected") {
      return "Esse concurso ainda nao foi publicado, mas ja da pra comecar com base no padrao anterior.";
    }

    if (selectedExistingContest?.id) {
      return "Boa escolha. Eu vou usar esse concurso como referencia para puxar seu comeco com mais precisao.";
    }

    return "";
  }, [contestMode, customName, selectedCatalogContest, selectedExistingContest]);

  const answerPreview = [
    contestLabel ? { label: "Prova", value: contestLabel } : null,
    examDate ? { label: "Data", value: examDate } : null,
    hours ? { label: "Rotina", value: `${hours} por dia` } : null,
    selectedLevelLabel ? { label: "Momento", value: selectedLevelLabel } : null,
    difficultiesList.length ? { label: "Travamentos", value: difficultiesList.join(", ") } : null,
    selectedExplanationLabel ? { label: "Explicação", value: selectedExplanationLabel } : null,
    selectedMoveLabel ? { label: "Destrava mais com", value: selectedMoveLabel } : null,
    selectedFocusLabel ? { label: "Foco inicial", value: selectedFocusLabel } : null,
  ].filter(Boolean);

  const steps = [
    {
      id: "contest",
      icon: Target,
      title: "Me conta qual prova eu vou colocar no centro do seu começo.",
      helper: "Pode escolher do catálogo ou criar um concurso personalizado. Eu organizo o resto a partir daqui.",
    },
    {
      id: "examDate",
      icon: CalendarDays,
      title: "Se já existir uma data, eu consigo calibrar melhor o seu ritmo.",
      helper: "Se isso ainda estiver em aberto, tudo bem. Eu ainda consigo te colocar no caminho certo.",
    },
    {
      id: "hours",
      icon: Clock3,
      title: "Quanto tempo cabe de verdade no seu dia sem virar peso?",
      helper: "Eu prefiro um plano que você consiga sustentar do que uma meta bonita que morre na primeira semana.",
    },
    {
      id: "level",
      icon: GraduationCap,
      title: "Hoje, como você sente que está nessa jornada?",
      helper: "Com isso eu ajusto profundidade, ritmo e a forma como vou te conduzir nos primeiros passos.",
    },
    {
      id: "difficulties",
      icon: ChartNoAxesColumn,
      title: "O que mais costuma te travar quando você tenta avançar?",
      helper: "Pode ser matéria, interpretação, cansaço, leitura ou aquele tipo de erro que sempre volta.",
    },
    {
      id: "explanation",
      icon: Sparkles,
      title: "Qual jeito de explicação faz você render melhor?",
      helper: "Eu adapto meu jeito de ensinar para você entender mais rápido e travar menos.",
    },
    {
      id: "move",
      icon: BookOpen,
      title: "Quando bate dúvida, o que mais te ajuda a sair do lugar?",
      helper: "Isso me ajuda a decidir se te puxo primeiro para teoria, exemplo, contraste ou prática.",
    },
    {
      id: "focus",
      icon: Brain,
      title: "Para o seu começo fazer sentido, onde você quer sentir evolução primeiro?",
      helper: "Esse foco vira a minha direção inicial com você.",
    },
    {
      id: "ready",
      icon: CircleCheckBig,
      title: "Seu começo está pronto.",
      helper: "Eu já consigo te entregar uma entrada mais clara, mais leve e com direção de verdade.",
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  const yaraReflection = useMemo(() => {
    if (!currentStep) return "";

    switch (currentStep.id) {
      case "contest":
        if (!contestLabel) return "";
        return (
          contestSelectionGuidance ||
          (contestMode === "custom"
            ? "Boa. Eu entro no seu cenario sem te forcar a seguir um caminho generico."
            : "Perfeito. Com essa prova no radar, eu ja consigo organizar o resto com mais precisao.")
        );
      case "examDate":
        if (!examDate) return "Se a data ainda não estiver fechada, tudo bem. O importante é te colocar em movimento agora.";
        {
          const targetDate = new Date(`${examDate}T00:00:00`);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diff = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
          if (diff > 0 && diff <= 60) {
            return "Com a prova mais perto, eu vou priorizar clareza, revisão e retomada curta para você não dispersar.";
          }
          if (diff > 60) {
            return "Ótimo. Com essa janela eu consigo equilibrar base, prática e constância sem te sufocar.";
          }
          return "Entendi. Então eu vou montar seu começo pensando em recuperar direção o mais rápido possível.";
        }
      case "hours":
        if (hours === "1") return "Com pouco tempo por dia, eu vou priorizar o que mais destrava seu avanço sem te sobrecarregar.";
        if (hours === "2") return "Dá para construir um ritmo firme e sustentável por aqui.";
        if (hours === "3") return "Ótimo. Já consigo te puxar com mais consistência sem perder clareza.";
        if (hours === "4+") return "Com esse espaço, eu consigo montar um começo mais agressivo sem deixar o estudo virar bagunça.";
        return "";
      case "level":
        if (!selectedLevelLabel) return "";
        return selectedLevelLabel === "Iniciante"
          ? "Perfeito. Então eu começo te dando base sem te afogar."
          : selectedLevelLabel === "Intermediário"
            ? "Boa. Você já tem terreno para avançar com mais ritmo."
            : "Ótimo. Então eu posso ser mais direta e te puxar para performance.";
      case "difficulties":
        if (!difficultiesList.length) return "";
        if (difficultiesList.some((item) => /interpret/i.test(item))) {
          return "Se interpretação te trava, eu vou simplificar leitura, destacar o que importa e te treinar para não perder tempo no enunciado.";
        }
        return "Entendi onde costuma pesar. Eu vou usar isso para ajustar suas explicações e suas revisões.";
      case "explanation":
        if (!selectedExplanationLabel) return "";
        return selectedExplanationLabel === "Mais direta"
          ? "Fechado. Quando der para ir ao ponto, eu vou sem rodeio."
          : selectedExplanationLabel === "Mais detalhada"
            ? "Perfeito. Então eu te entrego mais contexto antes de acelerar."
            : selectedExplanationLabel === "Com analogias"
              ? "Boa. Vou te explicar conectando com exemplos que fazem sentido mais rápido."
              : "Ótimo. Então eu quebro o raciocínio em passos pequenos para você ganhar tração.";
      case "move":
        if (!selectedMoveLabel) return "";
        return selectedMoveLabel === "Prática"
          ? "Perfeito. Então eu vou te levar mais cedo para questões, mas sem deixar faltar base."
          : selectedMoveLabel === "Exemplo"
            ? "Boa. Eu vou usar aplicação concreta para te destravar mais rápido."
            : selectedMoveLabel === "Contraste"
              ? "Ótimo. Comparar pegadinhas vai entrar cedo no seu fluxo."
              : "Fechado. Então eu começo te dando estrutura antes de exigir velocidade.";
      case "focus":
        if (!selectedFocusLabel) return "";
        return "Gostei. Vou usar isso como a primeira sensação de progresso que quero te entregar.";
      default:
        return "";
    }
  }, [
    contestLabel,
    contestSelectionGuidance,
    contestMode,
    currentStep,
    difficultiesList,
    examDate,
    hours,
    selectedExplanationLabel,
    selectedFocusLabel,
    selectedLevelLabel,
    selectedMoveLabel,
  ]);

  const readySummary = useMemo(() => {
    const focusLine = selectedFocusLabel || "Ganhar clareza logo no começo";
    const directionLine = contestLabel
      ? `Começar com ${contestLabel}${selectedLevelLabel ? ` em um ritmo ${selectedLevelLabel.toLowerCase()}` : ""}`
      : "Começar com um plano guiado pela sua rotina e pelo seu momento";
    let nextStepLine = "Entrar no seu plano inicial e te mostrar o próximo passo mais útil.";

    if (preferredStudyMove === "practice") {
      nextStepLine = "Te levar cedo para prática com contexto, sem pular a base que você precisa.";
    } else if (preferredStudyMove === "example") {
      nextStepLine = "Abrir com exemplos concretos para te colocar em movimento mais rápido.";
    } else if (preferredStudyMove === "contrast") {
      nextStepLine = "Usar contraste e pegadinhas para te ajudar a enxergar onde costuma errar.";
    } else if (preferredStudyMove === "theory") {
      nextStepLine = "Construir uma base clara antes de apertar o ritmo.";
    }

    return {
      focusLine,
      directionLine,
      nextStepLine,
    };
  }, [contestLabel, preferredStudyMove, selectedFocusLabel, selectedLevelLabel]);

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

  async function createContestFromCatalog(catalogEntry) {
    if (!catalogEntry?.name?.trim()) return null;

    setBusy(true);
    try {
      const { data: row, error } = await studyApi.ensureRuntimeContestFromCatalog(catalogEntry.id);
      if (error) throw error;
      if (!row?.id) throw new Error("Nao foi possivel preparar esse concurso para voce.");
      await studyApi.reloadContests();
      setResolvedContestSelection({ id: row.id, label: catalogEntry.name.trim(), catalogId: catalogEntry.id });
      return { id: row.id, label: catalogEntry.name.trim() };
    } catch (e) {
      setLocalError(e.message || "Erro ao preparar concurso.");
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
    if (found?.id) {
      return { id: pickedContestId, label: found?.name?.trim() || "" };
    }

    if (resolvedContestSelection?.catalogId === pickedContestId) {
      return resolvedContestSelection;
    }

    if (selectedCatalogContest) {
      return createContestFromCatalog(selectedCatalogContest);
    }

    setLocalError("Nao consegui reconhecer esse concurso. Tente escolher novamente.");
    return null;
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

    if (currentStep.id === "ready") {
      await handleFinish();
      return;
    }

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

  function selectCatalogContest(contestId) {
    setContestMode("existing");
    setPickedContestId(contestId);
    setResolvedContestSelection(null);
    clearCustomContestDraft();
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
            <strong>Isso aqui não é burocracia.</strong>
            <p>
              Cada resposta me ajuda a te receber do jeito certo: com mais direção, menos travamento e
              um começo que combina com a sua realidade.
            </p>
          </div>

          {answerPreview.length ? (
            <div className="aprova-onboarding-preview-card">
              <span className="aprova-onboarding-preview-title">O que eu já entendi sobre você</span>
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
          <div className="aprova-onboarding-question-card aprova-onboarding-stage-card" key={currentStep.id}>
            <div className="aprova-onboarding-question-head">
              <div className="aprova-onboarding-question-icon">
                <CurrentIcon size={18} />
              </div>
              <div>
                <span className="aprova-onboarding-question-eyebrow">
                  {currentStep.id === "ready" ? "Fechamento da Yara" : "Pergunta da Yara"}
                </span>
                <h3>{currentStep.title}</h3>
                <p>{currentStep.helper}</p>
              </div>
            </div>

            {currentStep.id === "contest" ? (
              <div className="aprova-onboarding-stack">
                <div className="aprova-onboarding-catalog-block">
                  <div className="aprova-onboarding-block-head">
                    <div>
                      <span className="aprova-onboarding-block-kicker">Bloco 1</span>
                      <h4>Sugestoes para voce</h4>
                    </div>
                    <p>
                      {preferredAreaLabel
                        ? `Estou priorizando concursos com mais cara de ${preferredAreaLabel}.`
                        : "Separei algumas previsoes boas para voce ja comecar com direcao."}
                    </p>
                  </div>

                  {catalogLoading ? (
                    <div className="aprova-onboarding-mini-callout">Carregando sugestoes do catalogo...</div>
                  ) : catalogSuggestions.length ? (
                    <div className="aprova-onboarding-suggestion-grid">
                      {catalogSuggestions.map((item) => {
                        const active = contestMode === "existing" && pickedContestId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`aprova-onboarding-choice-card aprova-onboarding-choice-card--left ${active ? "active" : ""}`}
                            onClick={() => selectCatalogContest(item.id)}
                          >
                            <div className="aprova-onboarding-contest-meta">
                              <span className="aprova-onboarding-contest-status">{getContestStatusLabel(item.status)}</span>
                              <span>{getContestForecastLabel(item)}</span>
                            </div>
                            <strong>{item.name}</strong>
                            <span>
                              {item.organ}
                              {item.area ? ` • ${item.area}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="aprova-onboarding-mini-callout">
                      Ainda nao tenho sugestoes prontas para essa area, mas voce pode buscar qualquer concurso abaixo.
                    </div>
                  )}
                </div>

                <div className="aprova-onboarding-catalog-block">
                  <div className="aprova-onboarding-block-head">
                    <div>
                      <span className="aprova-onboarding-block-kicker">Bloco 2</span>
                      <h4>Buscar concurso</h4>
                    </div>
                    <p>Se quiser liberdade total, procura qualquer concurso e eu sigo junto com a sua escolha.</p>
                  </div>

                  <label className="aprova-onboarding-input-wrap">
                    <span>Digite o nome do concurso ou do orgao</span>
                    <input
                      value={contestSearch}
                      onChange={(e) => {
                        setContestMode("existing");
                        setContestSearch(e.target.value);
                        clearCustomContestDraft();
                        setLocalError("");
                      }}
                      placeholder="Ex.: INSS, TJ-SP, PRF, Receita Federal..."
                      style={styles.profileInput}
                      className="aprova-onboarding-input"
                    />
                  </label>

                  {contestSearch.trim() ? (
                    catalogSearchLoading ? (
                      <div className="aprova-onboarding-mini-callout">Buscando concursos no catalogo...</div>
                    ) : catalogSearchResults.length ? (
                      <div className="aprova-onboarding-search-results">
                        {catalogSearchResults.map((item) => {
                          const active = contestMode === "existing" && pickedContestId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`aprova-onboarding-search-card ${active ? "active" : ""}`}
                              onClick={() => selectCatalogContest(item.id)}
                            >
                              <div>
                                <strong>{item.name}</strong>
                                <span>
                                  {item.organ}
                                  {item.predicted_year ? ` • ${getContestForecastLabel(item)}` : ""}
                                </span>
                              </div>
                              <em>{getContestStatusLabel(item.status)}</em>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="aprova-onboarding-mini-callout">
                        Nao achei esse nome no catalogo atual, mas voce pode criar o seu logo abaixo.
                      </div>
                    )
                  ) : null}
                </div>

                <div className="aprova-onboarding-catalog-block">
                  <div className="aprova-onboarding-block-head">
                    <div>
                      <span className="aprova-onboarding-block-kicker">Bloco 3</span>
                      <h4>Ou criar o seu</h4>
                    </div>
                    <p>Se a sua prova nao estiver aqui, eu monto esse ponto de partida com voce agora mesmo.</p>
                  </div>

                  <label className="aprova-onboarding-input-wrap">
                    <span>Nome da prova ou do concurso</span>
                    <input
                      placeholder="Ex.: TJ-SP, INSS ou concurso da sua cidade"
                      value={customName}
                      onChange={(e) => {
                        setContestMode("custom");
                        setPickedContestId("");
                        setCustomContestId("");
                        setResolvedContestSelection(null);
                        setCustomName(e.target.value);
                        setLocalError("");
                      }}
                      style={styles.profileInput}
                      className="aprova-onboarding-input"
                    />
                  </label>
                  <label className="aprova-onboarding-input-wrap">
                    <span>Se quiser, ja me diga a primeira materia</span>
                    <input
                      placeholder="Ex.: Constitucional"
                      value={customSubject}
                      onChange={(e) => {
                        setContestMode("custom");
                        setPickedContestId("");
                        setCustomContestId("");
                        setResolvedContestSelection(null);
                        setCustomSubject(e.target.value);
                        setLocalError("");
                      }}
                      style={styles.profileInput}
                      className="aprova-onboarding-input"
                    />
                  </label>
                  <label className="aprova-onboarding-input-wrap">
                    <span>Se ja souber, me diga tambem o primeiro topico</span>
                    <input
                      placeholder="Ex.: Controle de constitucionalidade"
                      value={customTopic}
                      onChange={(e) => {
                        setContestMode("custom");
                        setPickedContestId("");
                        setCustomContestId("");
                        setResolvedContestSelection(null);
                        setCustomTopic(e.target.value);
                        setLocalError("");
                      }}
                      style={styles.profileInput}
                      className="aprova-onboarding-input"
                    />
                  </label>
                </div>

                {contestSelectionGuidance ? (
                  <div className="aprova-onboarding-mini-callout aprova-onboarding-mini-callout--info">
                    {contestSelectionGuidance}
                  </div>
                ) : null}

                {contestMode === "existing" && selectedCatalogContest ? (
                  catalogTreeLoading ? (
                    <div className="aprova-onboarding-mini-callout">Carregando materias e topicos desse concurso...</div>
                  ) : catalogStructureSummary.length ? (
                    <div className="aprova-onboarding-catalog-preview">
                      <div className="aprova-onboarding-block-head">
                        <div>
                          <span className="aprova-onboarding-block-kicker">Estrutura real</span>
                          <h4>Materias e topicos desse concurso</h4>
                        </div>
                        <p>Esse edital previsto ja entra com uma arvore de estudo real para a Yara te guiar com mais precisao.</p>
                      </div>

                      <div className="aprova-onboarding-catalog-preview-grid">
                        {catalogStructureSummary.slice(0, 6).map((subject) => (
                          <div key={subject.id} className="aprova-onboarding-ready-item">
                            <span>{subject.weight != null ? `peso ${subject.weight}` : "materia"}</span>
                            <strong>{subject.name}</strong>
                            <small>{subject.topicNames.slice(0, 3).join(" • ") || "Topicos entrando em breve"}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="aprova-onboarding-mini-callout">
                      Esse concurso ainda nao tem materias e topicos detalhados no catalogo. Se quiser, voce pode seguir mesmo assim e a Yara entra com fallback temporario.
                    </div>
                  )
                ) : null}

                {catalogError ? <div className="aprova-onboarding-mini-callout">{catalogError}</div> : null}
              </div>
            ) : null}

            {currentStep.id === "examDate" ? (
              <label className="aprova-onboarding-input-wrap">
                <span>Se já souber, me passa a data da prova</span>
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
                <span>Pode me contar do seu jeito, sem formalidade</span>
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

            {currentStep.id === "ready" ? (
              <div className="aprova-onboarding-ready-card">
                <div className="aprova-onboarding-ready-hero">
                  <span className="aprova-onboarding-ready-kicker">Seu começo está pronto</span>
                  <h4>Agora eu já sei como te receber sem te jogar em um plano genérico.</h4>
                  <p>
                    Você não vai entrar para se virar sozinho. Eu vou começar te guiando com contexto,
                    prioridade e um próximo passo que faça sentido.
                  </p>
                </div>

                <div className="aprova-onboarding-ready-grid">
                  <div className="aprova-onboarding-ready-item">
                    <span>Foco inicial</span>
                    <strong>{readySummary.focusLine}</strong>
                  </div>
                  <div className="aprova-onboarding-ready-item">
                    <span>Direção inicial</span>
                    <strong>{readySummary.directionLine}</strong>
                  </div>
                  <div className="aprova-onboarding-ready-item">
                    <span>Próximo passo</span>
                    <strong>{readySummary.nextStepLine}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {yaraReflection && currentStep.id !== "ready" ? (
              <div className="aprova-onboarding-yara-response" aria-live="polite">
                <span className="aprova-onboarding-yara-response-label">Yara te responde</span>
                <p>{yaraReflection}</p>
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
              {busy ? "Salvando..." : isLastStep ? "Entrar no meu plano" : "Continuar"}
              {!busy ? <ArrowRight size={16} /> : null}
            </button>
          </div>

          <div className="aprova-onboarding-footnote">
            <CircleCheckBig size={18} color="#86efac" style={{ marginTop: 1, flexShrink: 0 }} />
            <p>
              Você pode ajustar tudo depois. Aqui eu só estou pegando o essencial para te colocar em
              movimento do jeito certo, sem travar sua entrada.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export const OnboardingModal = memo(OnboardingModalComponent);
