import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, ShieldCheck, Trash2, PencilLine, Save, XCircle, Copy, FileText } from "lucide-react";
import * as adminApi from "../api/adminCatalogApi.js";
import { buildAdminYaraReport } from "../utils/adminYaraReport.js";

const areaOptions = [
  { value: "administrativa", label: "Administrativa" },
  { value: "policial", label: "Policial" },
  { value: "tribunais", label: "Tribunais" },
  { value: "controle", label: "Controle" },
  { value: "fiscal", label: "Fiscal" },
  { value: "educacao", label: "Educacao" },
  { value: "bancaria", label: "Bancaria" },
];

const statusOptions = [
  { value: "planned", label: "Planned" },
  { value: "expected", label: "Expected" },
  { value: "confirmed", label: "Confirmed" },
];

const monthOptions = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Fev" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Set" },
  { value: 10, label: "Out" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dez" },
];

function buildEmptyContestForm() {
  return {
    name: "",
    organ: "",
    area: "administrativa",
    predicted_year: String(new Date().getFullYear()),
    predicted_month: "1",
    status: "expected",
  };
}

function buildEmptySubjectForm() {
  return {
    name: "",
    weight: "1",
    display_order: "0",
  };
}

function buildEmptyTopicForm() {
  return {
    name: "",
    weight: "1",
    display_order: "0",
  };
}

function AdminContestsPageComponent({ supabase, session, onBackToApp }) {
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [catalogEntries, setCatalogEntries] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminActionBusy, setAdminActionBusy] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");
  const [contestForm, setContestForm] = useState(buildEmptyContestForm);
  const [contestActionBusy, setContestActionBusy] = useState(false);
  const [contestActionError, setContestActionError] = useState("");
  const [editingContestId, setEditingContestId] = useState("");
  const [selectedCatalogContestId, setSelectedCatalogContestId] = useState("");
  const [catalogSubjects, setCatalogSubjects] = useState([]);
  const [selectedCatalogSubjectId, setSelectedCatalogSubjectId] = useState("");
  const [catalogTopics, setCatalogTopics] = useState([]);
  const [subjectForm, setSubjectForm] = useState(buildEmptySubjectForm);
  const [editingSubjectId, setEditingSubjectId] = useState("");
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [subjectError, setSubjectError] = useState("");
  const [topicForm, setTopicForm] = useState(buildEmptyTopicForm);
  const [editingTopicId, setEditingTopicId] = useState("");
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicError, setTopicError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportData, setReportData] = useState(null);
  const [reportCopied, setReportCopied] = useState(false);
  const reportTextareaRef = useRef(null);

  const currentEmail = String(session?.user?.email ?? "").trim().toLowerCase();

  const loadData = useCallback(async () => {
    if (!session?.user?.id) {
      setAccessDenied(true);
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);
    setLoadError("");

    const { data: isAdmin, error: adminCheckError } = await adminApi.isAdminUser(supabase);
    if (adminCheckError || !isAdmin) {
      setAccessDenied(true);
      setAccessLoading(false);
      return;
    }

    const [{ data: adminRows, error: adminRowsError }, { data: contestRows, error: contestRowsError }] =
      await Promise.all([adminApi.fetchAdminUsers(supabase), adminApi.fetchCatalogEntries(supabase)]);

    if (adminRowsError || contestRowsError) {
      setLoadError(adminRowsError?.message || contestRowsError?.message || "Nao consegui carregar o painel admin.");
      setAccessDenied(false);
      setAccessLoading(false);
      return;
    }

    const normalizedAdmins = adminRows ?? [];
    const isListedAdmin = normalizedAdmins.some((item) => item.email?.trim().toLowerCase() === currentEmail);
    if (!isListedAdmin) {
      setAccessDenied(true);
      setAccessLoading(false);
      return;
    }

    setAdmins(normalizedAdmins);
    setCatalogEntries(contestRows ?? []);
    setSelectedCatalogContestId((prev) => prev || contestRows?.[0]?.id || "");
    setAccessDenied(false);
    setAccessLoading(false);
  }, [currentEmail, session?.user?.id, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sortedCatalogEntries = useMemo(
    () =>
      [...catalogEntries].sort((a, b) => {
        const yearDiff = Number(a.predicted_year ?? 0) - Number(b.predicted_year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        const monthDiff = Number(a.predicted_month ?? 0) - Number(b.predicted_month ?? 0);
        if (monthDiff !== 0) return monthDiff;
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      }),
    [catalogEntries]
  );

  const selectedCatalogContest = useMemo(
    () => sortedCatalogEntries.find((entry) => entry.id === selectedCatalogContestId) || null,
    [selectedCatalogContestId, sortedCatalogEntries]
  );

  const selectedCatalogSubject = useMemo(
    () => catalogSubjects.find((entry) => entry.id === selectedCatalogSubjectId) || null,
    [catalogSubjects, selectedCatalogSubjectId]
  );

  useEffect(() => {
    if (!selectedCatalogContestId) {
      setCatalogSubjects([]);
      setSelectedCatalogSubjectId("");
      return;
    }

    let cancelled = false;
    async function loadSubjects() {
      const { data, error } = await adminApi.fetchCatalogSubjects(supabase, selectedCatalogContestId);
      if (cancelled) return;
      if (error) {
        setSubjectError(error.message || "Nao consegui carregar as materias.");
        setCatalogSubjects([]);
        setSelectedCatalogSubjectId("");
      } else {
        setSubjectError("");
        setCatalogSubjects(data ?? []);
        setSelectedCatalogSubjectId((prev) => prev || data?.[0]?.id || "");
      }
    }
    void loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [selectedCatalogContestId, supabase]);

  useEffect(() => {
    if (!selectedCatalogSubjectId) {
      setCatalogTopics([]);
      return;
    }

    let cancelled = false;
    async function loadTopics() {
      const { data, error } = await adminApi.fetchCatalogSubjectTopics(supabase, selectedCatalogSubjectId);
      if (cancelled) return;
      if (error) {
        setTopicError(error.message || "Nao consegui carregar os topicos.");
        setCatalogTopics([]);
      } else {
        setTopicError("");
        setCatalogTopics(data ?? []);
      }
    }
    void loadTopics();
    return () => {
      cancelled = true;
    };
  }, [selectedCatalogSubjectId, supabase]);

  function resetContestForm() {
    setContestForm(buildEmptyContestForm());
    setEditingContestId("");
    setContestActionError("");
  }

  function resetSubjectForm() {
    setSubjectForm(buildEmptySubjectForm());
    setEditingSubjectId("");
    setSubjectError("");
  }

  function resetTopicForm() {
    setTopicForm(buildEmptyTopicForm());
    setEditingTopicId("");
    setTopicError("");
  }

  async function handleAddAdmin() {
    setAdminActionError("");
    const normalizedEmail = newAdminEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setAdminActionError("Digite um email valido.");
      return;
    }

    setAdminActionBusy(true);
    try {
      const { error } = await adminApi.createAdminUser(supabase, normalizedEmail);
      if (error) throw error;
      setNewAdminEmail("");
      await loadData();
    } catch (error) {
      setAdminActionError(error.message || "Nao consegui adicionar esse admin.");
    } finally {
      setAdminActionBusy(false);
    }
  }

  async function handleRemoveAdmin(adminId, email) {
    if (email.trim().toLowerCase() === currentEmail) {
      setAdminActionError("Voce nao pode remover o proprio acesso por aqui.");
      return;
    }

    setAdminActionError("");
    setAdminActionBusy(true);
    try {
      const { error } = await adminApi.deleteAdminUser(supabase, adminId);
      if (error) throw error;
      await loadData();
    } catch (error) {
      setAdminActionError(error.message || "Nao consegui remover esse admin.");
    } finally {
      setAdminActionBusy(false);
    }
  }

  async function handleSaveContest() {
    setContestActionError("");
    if (!contestForm.name.trim() || !contestForm.organ.trim()) {
      setContestActionError("Preencha nome e orgao.");
      return;
    }

    setContestActionBusy(true);
    try {
      const payload = {
        name: contestForm.name.trim(),
        organ: contestForm.organ.trim(),
        area: contestForm.area,
        predicted_year: Number.parseInt(contestForm.predicted_year, 10) || new Date().getFullYear(),
        predicted_month: Number.parseInt(contestForm.predicted_month, 10) || 1,
        status: contestForm.status,
      };

      const response = editingContestId
        ? await adminApi.updateCatalogEntry(supabase, editingContestId, payload)
        : await adminApi.createCatalogEntry(supabase, payload);

      if (response.error) throw response.error;
      if (response.data?.id) {
        await adminApi.syncRuntimeContest(supabase, response.data.id);
        setSelectedCatalogContestId(response.data.id);
      }

      resetContestForm();
      await loadData();
    } catch (error) {
      setContestActionError(error.message || "Nao consegui salvar esse concurso.");
    } finally {
      setContestActionBusy(false);
    }
  }

  async function handleDeleteContest(contestId) {
    setContestActionError("");
    setContestActionBusy(true);
    try {
      const { error } = await adminApi.deleteCatalogEntry(supabase, contestId);
      if (error) throw error;
      if (editingContestId === contestId) {
        resetContestForm();
      }
      if (selectedCatalogContestId === contestId) {
        setSelectedCatalogContestId("");
        setSelectedCatalogSubjectId("");
      }
      await loadData();
    } catch (error) {
      setContestActionError(error.message || "Nao consegui deletar esse concurso.");
    } finally {
      setContestActionBusy(false);
    }
  }

  function handleStartEdit(entry) {
    setEditingContestId(entry.id);
    setContestActionError("");
    setContestForm({
      name: entry.name ?? "",
      organ: entry.organ ?? "",
      area: entry.area ?? "administrativa",
      predicted_year: String(entry.predicted_year ?? new Date().getFullYear()),
      predicted_month: String(entry.predicted_month ?? 1),
      status: entry.status ?? "expected",
    });
  }

  async function handleSaveSubject() {
    if (!selectedCatalogContestId) {
      setSubjectError("Escolha um concurso primeiro.");
      return;
    }

    if (!subjectForm.name.trim()) {
      setSubjectError("Digite o nome da materia.");
      return;
    }

    setSubjectBusy(true);
    setSubjectError("");
    try {
      const payload = {
        contest_id: selectedCatalogContestId,
        name: subjectForm.name.trim(),
        weight: Number(subjectForm.weight) || 1,
        display_order: Number.parseInt(subjectForm.display_order, 10) || 0,
      };
      const response = editingSubjectId
        ? await adminApi.updateCatalogSubject(supabase, editingSubjectId, payload)
        : await adminApi.createCatalogSubject(supabase, payload);
      if (response.error) throw response.error;
      await adminApi.syncRuntimeContest(supabase, selectedCatalogContestId);
      resetSubjectForm();
      const { data } = await adminApi.fetchCatalogSubjects(supabase, selectedCatalogContestId);
      setCatalogSubjects(data ?? []);
      if (response.data?.id) setSelectedCatalogSubjectId(response.data.id);
    } catch (error) {
      setSubjectError(error.message || "Nao consegui salvar a materia.");
    } finally {
      setSubjectBusy(false);
    }
  }

  async function handleDeleteSubject(subjectId) {
    if (!selectedCatalogContestId) return;
    setSubjectBusy(true);
    setSubjectError("");
    try {
      const { error } = await adminApi.deleteCatalogSubject(supabase, subjectId);
      if (error) throw error;
      await adminApi.syncRuntimeContest(supabase, selectedCatalogContestId);
      if (editingSubjectId === subjectId) resetSubjectForm();
      const { data } = await adminApi.fetchCatalogSubjects(supabase, selectedCatalogContestId);
      setCatalogSubjects(data ?? []);
      setSelectedCatalogSubjectId((prev) => (prev === subjectId ? data?.[0]?.id || "" : prev));
    } catch (error) {
      setSubjectError(error.message || "Nao consegui deletar a materia.");
    } finally {
      setSubjectBusy(false);
    }
  }

  function handleStartEditSubject(entry) {
    setEditingSubjectId(entry.id);
    setSubjectForm({
      name: entry.name ?? "",
      weight: String(entry.weight ?? 1),
      display_order: String(entry.display_order ?? 0),
    });
  }

  async function handleSaveTopic() {
    if (!selectedCatalogSubjectId || !selectedCatalogContestId) {
      setTopicError("Escolha uma materia primeiro.");
      return;
    }

    if (!topicForm.name.trim()) {
      setTopicError("Digite o nome do topico.");
      return;
    }

    setTopicBusy(true);
    setTopicError("");
    try {
      const payload = {
        contest_subject_id: selectedCatalogSubjectId,
        name: topicForm.name.trim(),
        weight: Number(topicForm.weight) || 1,
        display_order: Number.parseInt(topicForm.display_order, 10) || 0,
      };
      const response = editingTopicId
        ? await adminApi.updateCatalogSubjectTopic(supabase, editingTopicId, payload)
        : await adminApi.createCatalogSubjectTopic(supabase, payload);
      if (response.error) throw response.error;
      await adminApi.syncRuntimeContest(supabase, selectedCatalogContestId);
      resetTopicForm();
      const { data } = await adminApi.fetchCatalogSubjectTopics(supabase, selectedCatalogSubjectId);
      setCatalogTopics(data ?? []);
    } catch (error) {
      setTopicError(error.message || "Nao consegui salvar o topico.");
    } finally {
      setTopicBusy(false);
    }
  }

  async function handleGenerateReport() {
    setReportBusy(true);
    setReportError("");
    setReportCopied(false);
    try {
      const { data, error } = await adminApi.fetchAdminYaraReportSignals(supabase);
      if (error) throw error;
      const builtReport = buildAdminYaraReport(data ?? {});
      setReportData(builtReport);
      setReportText(builtReport.copyReadyText);
    } catch (error) {
      setReportError(error.message || "Nao consegui gerar o relatorio da Yara.");
    } finally {
      setReportBusy(false);
    }
  }

  async function handleCopyReport() {
    if (!reportText.trim()) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportText);
      } else if (reportTextareaRef.current) {
        reportTextareaRef.current.focus();
        reportTextareaRef.current.select();
        document.execCommand("copy");
      }
      setReportCopied(true);
      window.setTimeout(() => setReportCopied(false), 1800);
    } catch (error) {
      setReportError(error.message || "Nao consegui copiar o relatorio.");
    }
  }

  async function handleDeleteTopic(topicId) {
    if (!selectedCatalogSubjectId || !selectedCatalogContestId) return;
    setTopicBusy(true);
    setTopicError("");
    try {
      const { error } = await adminApi.deleteCatalogSubjectTopic(supabase, topicId);
      if (error) throw error;
      await adminApi.syncRuntimeContest(supabase, selectedCatalogContestId);
      if (editingTopicId === topicId) resetTopicForm();
      const { data } = await adminApi.fetchCatalogSubjectTopics(supabase, selectedCatalogSubjectId);
      setCatalogTopics(data ?? []);
    } catch (error) {
      setTopicError(error.message || "Nao consegui deletar o topico.");
    } finally {
      setTopicBusy(false);
    }
  }

  function handleStartEditTopic(entry) {
    setEditingTopicId(entry.id);
    setTopicForm({
      name: entry.name ?? "",
      weight: String(entry.weight ?? 1),
      display_order: String(entry.display_order ?? 0),
    });
  }

  if (accessLoading) {
    return (
      <div className="aprova-admin-page">
        <div className="aprova-admin-shell">
          <div className="aprova-admin-empty-state">Carregando painel admin...</div>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="aprova-admin-page">
        <div className="aprova-admin-shell">
          <div className="aprova-admin-empty-state">
            <h1>Acesso negado</h1>
            <p>Essa area e restrita a administradores do catalogo.</p>
            <button type="button" className="aprova-admin-back" onClick={onBackToApp}>
              <ArrowLeft size={16} />
              Voltar ao app
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aprova-admin-page">
      <div className="aprova-admin-shell">
        <div className="aprova-admin-header">
          <div>
            <span className="aprova-admin-kicker">Painel admin</span>
            <h1>Catalogo de concursos e administradores</h1>
            <p>Painel de lancamento para gerir admins e manter o catalogo oficial da Yara.</p>
          </div>
          <button type="button" className="aprova-admin-back" onClick={onBackToApp}>
            <ArrowLeft size={16} />
            Voltar ao app
          </button>
        </div>

        {loadError ? <div className="aprova-admin-error">{loadError}</div> : null}

        <section className="aprova-admin-card">
          <div className="aprova-admin-card-head">
            <div>
              <span className="aprova-admin-section-kicker">Relatorio estrategico</span>
              <h2>Relatorio Estrategico da Yara</h2>
              <p>Resumo executivo com friccoes, sinais de forca, fragilidades e prioridades para o produto.</p>
            </div>
            <FileText size={18} />
          </div>

          <div className="aprova-admin-actions">
            <button type="button" className="aprova-admin-primary" disabled={reportBusy} onClick={() => void handleGenerateReport()}>
              <FileText size={16} />
              {reportBusy ? "Gerando relatorio..." : "Gerar relatorio"}
            </button>
            <button type="button" className="aprova-admin-ghost" disabled={!reportText.trim()} onClick={() => void handleCopyReport()}>
              <Copy size={16} />
              {reportCopied ? "Copiado" : "Copiar relatorio"}
            </button>
          </div>

          {reportError ? <div className="aprova-admin-error">{reportError}</div> : null}

          {reportData ? (
            <div className="aprova-admin-report-meta">
              <span>Gerado em {reportData.generatedAtLabel}</span>
              <span>{reportData.summary.activeUsers14d} usuarios ativos em 14 dias</span>
              <span>{reportData.summary.totalAttempts14d} tentativas recentes</span>
              <span>Fontes: {reportData.sourcesUsed.join(", ")}</span>
            </div>
          ) : (
            <div className="aprova-admin-empty-state aprova-admin-report-empty">
              Gere o relatorio para consolidar sinais de onboarding, estudo, questoes, catalogo e comportamento recente da Yara.
            </div>
          )}

          <textarea
            ref={reportTextareaRef}
            className="aprova-admin-input aprova-admin-report-output"
            value={reportText}
            readOnly
            placeholder="O relatorio gerado vai aparecer aqui, pronto para copiar e colar."
          />
        </section>

        <div className="aprova-admin-grid">
          <section className="aprova-admin-card">
            <div className="aprova-admin-card-head">
              <div>
                <span className="aprova-admin-section-kicker">Admins</span>
                <h2>Quem pode gerenciar o catalogo</h2>
              </div>
              <ShieldCheck size={18} />
            </div>

            <div className="aprova-admin-inline-form">
              <input
                value={newAdminEmail}
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="novo-admin@aprova.com"
                className="aprova-admin-input"
              />
              <button type="button" onClick={() => void handleAddAdmin()} disabled={adminActionBusy} className="aprova-admin-primary">
                <Plus size={16} />
                Adicionar admin
              </button>
            </div>

            {adminActionError ? <div className="aprova-admin-error">{adminActionError}</div> : null}

            <div className="aprova-admin-list">
              {admins.map((admin) => {
                const isSelf = admin.email?.trim().toLowerCase() === currentEmail;
                return (
                  <div key={admin.id} className="aprova-admin-list-row">
                    <div>
                      <strong>{admin.email}</strong>
                      <span>{isSelf ? "Seu acesso atual" : "Admin ativo"}</span>
                    </div>
                    <button
                      type="button"
                      className="aprova-admin-ghost"
                      disabled={adminActionBusy || isSelf}
                      onClick={() => void handleRemoveAdmin(admin.id, admin.email)}
                    >
                      <Trash2 size={15} />
                      Remover
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="aprova-admin-card">
            <div className="aprova-admin-card-head">
              <div>
                <span className="aprova-admin-section-kicker">Concursos</span>
                <h2>{editingContestId ? "Editar concurso do catalogo" : "Criar concurso no catalogo"}</h2>
              </div>
            </div>

            <div className="aprova-admin-form-grid">
              <label className="aprova-admin-field">
                <span>Nome</span>
                <input
                  className="aprova-admin-input"
                  value={contestForm.name}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex.: INSS 2026"
                />
              </label>

              <label className="aprova-admin-field">
                <span>Orgao</span>
                <input
                  className="aprova-admin-input"
                  value={contestForm.organ}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, organ: event.target.value }))}
                  placeholder="Ex.: Instituto Nacional do Seguro Social"
                />
              </label>

              <label className="aprova-admin-field">
                <span>Area</span>
                <select
                  className="aprova-admin-input"
                  value={contestForm.area}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, area: event.target.value }))}
                >
                  {areaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="aprova-admin-field">
                <span>Status</span>
                <select
                  className="aprova-admin-input"
                  value={contestForm.status}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="aprova-admin-field">
                <span>Ano previsto</span>
                <input
                  className="aprova-admin-input"
                  value={contestForm.predicted_year}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, predicted_year: event.target.value }))}
                  placeholder="2026"
                />
              </label>

              <label className="aprova-admin-field">
                <span>Mes previsto</span>
                <select
                  className="aprova-admin-input"
                  value={contestForm.predicted_month}
                  onChange={(event) => setContestForm((prev) => ({ ...prev, predicted_month: event.target.value }))}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="aprova-admin-actions">
              <button
                type="button"
                onClick={() => void handleSaveContest()}
                disabled={contestActionBusy}
                className="aprova-admin-primary"
              >
                {editingContestId ? <Save size={16} /> : <Plus size={16} />}
                {editingContestId ? "Salvar alteracoes" : "Criar concurso"}
              </button>

              {editingContestId ? (
                <button type="button" onClick={resetContestForm} disabled={contestActionBusy} className="aprova-admin-ghost">
                  <XCircle size={16} />
                  Cancelar edicao
                </button>
              ) : null}
            </div>

            {contestActionError ? <div className="aprova-admin-error">{contestActionError}</div> : null}
          </section>
        </div>

        <section className="aprova-admin-card">
          <div className="aprova-admin-card-head">
            <div>
              <span className="aprova-admin-section-kicker">Catalogo atual</span>
              <h2>{sortedCatalogEntries.length} concursos prontos para onboarding e lancamento</h2>
            </div>
          </div>

          <div className="aprova-admin-table">
            {sortedCatalogEntries.map((entry) => (
              <div
                key={entry.id}
                className={`aprova-admin-table-row ${selectedCatalogContestId === entry.id ? "is-active" : ""}`}
              >
                <div className="aprova-admin-table-main">
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.organ} • {entry.area} • {entry.predicted_month}/{entry.predicted_year} • {entry.status}
                  </span>
                </div>
                <div className="aprova-admin-table-actions">
                  <button
                    type="button"
                    className="aprova-admin-ghost"
                    onClick={() => setSelectedCatalogContestId(entry.id)}
                  >
                    Abrir arvore
                  </button>
                  <button type="button" className="aprova-admin-ghost" onClick={() => handleStartEdit(entry)}>
                    <PencilLine size={15} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="aprova-admin-ghost aprova-admin-ghost--danger"
                    disabled={contestActionBusy}
                    onClick={() => void handleDeleteContest(entry.id)}
                  >
                    <Trash2 size={15} />
                    Deletar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="aprova-admin-grid aprova-admin-grid--tree">
          <section className="aprova-admin-card">
            <div className="aprova-admin-card-head">
              <div>
                <span className="aprova-admin-section-kicker">Materias do concurso</span>
                <h2>
                  {selectedCatalogContest ? `Estrutura de ${selectedCatalogContest.name}` : "Escolha um concurso"}
                </h2>
              </div>
            </div>

            {selectedCatalogContest ? (
              <>
                <div className="aprova-admin-form-grid">
                  <label className="aprova-admin-field">
                    <span>Materia</span>
                    <input
                      className="aprova-admin-input"
                      value={subjectForm.name}
                      onChange={(event) => setSubjectForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Ex.: Direito Previdenciario"
                    />
                  </label>
                  <label className="aprova-admin-field">
                    <span>Peso</span>
                    <input
                      className="aprova-admin-input"
                      value={subjectForm.weight}
                      onChange={(event) => setSubjectForm((prev) => ({ ...prev, weight: event.target.value }))}
                    />
                  </label>
                  <label className="aprova-admin-field">
                    <span>Ordem</span>
                    <input
                      className="aprova-admin-input"
                      value={subjectForm.display_order}
                      onChange={(event) => setSubjectForm((prev) => ({ ...prev, display_order: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="aprova-admin-actions">
                  <button type="button" className="aprova-admin-primary" disabled={subjectBusy} onClick={() => void handleSaveSubject()}>
                    {editingSubjectId ? <Save size={16} /> : <Plus size={16} />}
                    {editingSubjectId ? "Salvar materia" : "Adicionar materia"}
                  </button>
                  {editingSubjectId ? (
                    <button type="button" className="aprova-admin-ghost" onClick={resetSubjectForm}>
                      <XCircle size={16} />
                      Cancelar
                    </button>
                  ) : null}
                </div>
                {subjectError ? <div className="aprova-admin-error">{subjectError}</div> : null}

                <div className="aprova-admin-table">
                  {catalogSubjects.map((entry) => (
                    <div
                      key={entry.id}
                      className={`aprova-admin-table-row ${selectedCatalogSubjectId === entry.id ? "is-active" : ""}`}
                    >
                      <div className="aprova-admin-table-main">
                        <strong>{entry.name}</strong>
                        <span>Peso {entry.weight} • ordem {entry.display_order}</span>
                      </div>
                      <div className="aprova-admin-table-actions">
                        <button type="button" className="aprova-admin-ghost" onClick={() => setSelectedCatalogSubjectId(entry.id)}>
                          Topicos
                        </button>
                        <button type="button" className="aprova-admin-ghost" onClick={() => handleStartEditSubject(entry)}>
                          <PencilLine size={15} />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="aprova-admin-ghost aprova-admin-ghost--danger"
                          onClick={() => void handleDeleteSubject(entry.id)}
                        >
                          <Trash2 size={15} />
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="aprova-admin-empty-state">Escolha um concurso acima para gerenciar as materias.</div>
            )}
          </section>

          <section className="aprova-admin-card">
            <div className="aprova-admin-card-head">
              <div>
                <span className="aprova-admin-section-kicker">Topicos da materia</span>
                <h2>{selectedCatalogSubject ? selectedCatalogSubject.name : "Escolha uma materia"}</h2>
              </div>
            </div>

            {selectedCatalogSubject ? (
              <>
                <div className="aprova-admin-form-grid">
                  <label className="aprova-admin-field">
                    <span>Topico</span>
                    <input
                      className="aprova-admin-input"
                      value={topicForm.name}
                      onChange={(event) => setTopicForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Ex.: Segurados e dependentes"
                    />
                  </label>
                  <label className="aprova-admin-field">
                    <span>Peso</span>
                    <input
                      className="aprova-admin-input"
                      value={topicForm.weight}
                      onChange={(event) => setTopicForm((prev) => ({ ...prev, weight: event.target.value }))}
                    />
                  </label>
                  <label className="aprova-admin-field">
                    <span>Ordem</span>
                    <input
                      className="aprova-admin-input"
                      value={topicForm.display_order}
                      onChange={(event) => setTopicForm((prev) => ({ ...prev, display_order: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="aprova-admin-actions">
                  <button type="button" className="aprova-admin-primary" disabled={topicBusy} onClick={() => void handleSaveTopic()}>
                    {editingTopicId ? <Save size={16} /> : <Plus size={16} />}
                    {editingTopicId ? "Salvar topico" : "Adicionar topico"}
                  </button>
                  {editingTopicId ? (
                    <button type="button" className="aprova-admin-ghost" onClick={resetTopicForm}>
                      <XCircle size={16} />
                      Cancelar
                    </button>
                  ) : null}
                </div>
                {topicError ? <div className="aprova-admin-error">{topicError}</div> : null}

                <div className="aprova-admin-table">
                  {catalogTopics.map((entry) => (
                    <div key={entry.id} className="aprova-admin-table-row">
                      <div className="aprova-admin-table-main">
                        <strong>{entry.name}</strong>
                        <span>Peso {entry.weight} • ordem {entry.display_order}</span>
                      </div>
                      <div className="aprova-admin-table-actions">
                        <button type="button" className="aprova-admin-ghost" onClick={() => handleStartEditTopic(entry)}>
                          <PencilLine size={15} />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="aprova-admin-ghost aprova-admin-ghost--danger"
                          onClick={() => void handleDeleteTopic(entry.id)}
                        >
                          <Trash2 size={15} />
                          Deletar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="aprova-admin-empty-state">Escolha uma materia para gerenciar os topicos.</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export const AdminContestsPage = memo(AdminContestsPageComponent);
