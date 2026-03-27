import { useCallback, useEffect, useState } from "react";
import * as activityApi from "../api/studyActivityApi.js";
import { computeDaysUntilExam } from "../utils/examDate.js";
import { readLastStudySession } from "../utils/studySessionStorage.js";
import { buildStudyResumeJourney } from "../utils/studyResumeJourney.js";
import {
  accuracyByUtcDay,
  computeConsecutiveStudyStreak,
  pctAccuracy,
  utcDateKeyFromIso,
} from "../utils/studyStreak.js";

const TAB_LABELS = {
  explanation: "Conversa",
  questions: "Questões",
  chat: "Conversa",
};

function aggregateAttempts(rows) {
  const list = rows ?? [];
  let correct = 0;
  let wrong = 0;
  for (const r of list) {
    if (r.is_correct) correct += 1;
    else wrong += 1;
  }
  return { total: list.length, correct, wrong };
}

function wrongCountByTopic(rows) {
  const m = new Map();
  for (const r of rows ?? []) {
    if (!r.topic_id) continue;
    if (!r.is_correct) m.set(r.topic_id, (m.get(r.topic_id) ?? 0) + 1);
  }
  return m;
}

function attemptsCountByTopic(rows) {
  const m = new Map();
  for (const r of rows ?? []) {
    if (!r.topic_id) continue;
    m.set(r.topic_id, (m.get(r.topic_id) ?? 0) + 1);
  }
  return m;
}

/**
 * Métricas reais para o dashboard de estudo.
 */
export function useDashboardStudy(supabase, session, { examDate, mainExamId, hoursPerDay }) {
  const userId = session?.user?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [topicsTotal, setTopicsTotal] = useState(0);
  const [topicsStudiedMain, setTopicsStudiedMain] = useState(0);
  const [questionSends, setQuestionSends] = useState(0);
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizWrong, setQuizWrong] = useState(0);
  const [studyDays, setStudyDays] = useState(0);
  const [recentRows, setRecentRows] = useState([]);
  const [suggestion, setSuggestion] = useState("");
  const [planLines, setPlanLines] = useState([]);
  const [continueProgressLine, setContinueProgressLine] = useState("");
  const [studyStreak, setStudyStreak] = useState(0);
  const [dailyMissions, setDailyMissions] = useState([]);
  const [evolutionLines, setEvolutionLines] = useState([]);
  /** Próximo tópico sugerido (mesmo critério da sugestão em texto), para "Estudar agora". */
  const [suggestedStudyRoute, setSuggestedStudyRoute] = useState(null);
  const [overallProgressPct, setOverallProgressPct] = useState(0);
  const [subjectProgress, setSubjectProgress] = useState([]);
  const [adaptiveFocusHint, setAdaptiveFocusHint] = useState("");
  /** Rótulos do próximo passo sugerido (para UI do estudo). */
  const [suggestedNextTopicName, setSuggestedNextTopicName] = useState("");
  const [suggestedNextSubjectName, setSuggestedNextSubjectName] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) {
      setTopicsTotal(0);
      setTopicsStudiedMain(0);
      setQuestionSends(0);
      setQuizAttempts(0);
      setQuizCorrect(0);
      setQuizWrong(0);
      setStudyDays(0);
      setRecentRows([]);
      setSuggestion("");
      setPlanLines([]);
      setContinueProgressLine("");
      setStudyStreak(0);
      setDailyMissions([]);
      setEvolutionLines([]);
      setSuggestedStudyRoute(null);
      setOverallProgressPct(0);
      setSubjectProgress([]);
      setAdaptiveFocusHint("");
      setSuggestedNextTopicName("");
      setSuggestedNextSubjectName("");
      return;
    }

    setLoading(true);
    try {
      let totalTopics = 0;
      const daysLeft = computeDaysUntilExam(examDate);

      const { count: qCount, error: qErr } = await activityApi.countUserQuestionMessages(supabase, userId);
      if (!qErr) setQuestionSends(qCount ?? 0);

      const { count: tTotal, error: tErr } = await activityApi.countTopicsInContest(supabase, mainExamId);
      if (!tErr) {
        totalTopics = tTotal;
        setTopicsTotal(tTotal);
      }

      const { data: visited, error: vErr } = await activityApi.fetchVisitedTopicIdsForContest(
        supabase,
        userId,
        mainExamId
      );
      const studiedSet = new Set((visited ?? []).map((r) => r.topic_id).filter(Boolean));
      if (!vErr) setTopicsStudiedMain(studiedSet.size);

      const { data: streakRows, error: streakErr } = await activityApi.fetchVisitRowsForStreak(
        supabase,
        userId,
        4000
      );
      if (!streakErr && streakRows?.length) {
        setStudyStreak(computeConsecutiveStudyStreak(streakRows));
        const days = new Set(
          streakRows.map((s) => utcDateKeyFromIso(s.visited_at)).filter(Boolean)
        );
        setStudyDays(days.size);
      } else {
        setStudyStreak(0);
        setStudyDays(0);
      }

      const nowUtc = new Date();
      const todayStart = new Date(nowUtc);
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayStartIso = todayStart.toISOString();

      const { count: visitTodayCount, error: vTodayErr } = await activityApi.countVisitsSince(
        supabase,
        userId,
        todayStartIso
      );
      const visitToday = !vTodayErr && (visitTodayCount ?? 0) > 0;

      const { count: attemptsTodayCount, error: aTodayErr } = await activityApi.countAttemptsSince(
        supabase,
        userId,
        todayStartIso
      );
      const attemptsToday = !aTodayErr && (attemptsTodayCount ?? 0) > 0;

      const since14 = new Date(nowUtc);
      since14.setUTCDate(since14.getUTCDate() - 14);
      const { data: attHistoryRaw, error: histErr } = await activityApi.fetchAttemptsSince(
        supabase,
        userId,
        since14.toISOString()
      );
      const attHistory = histErr ? [] : (attHistoryRaw ?? []);
      const byDay = accuracyByUtcDay(attHistory);
      const todayKey = nowUtc.toISOString().slice(0, 10);
      const yDate = new Date(nowUtc);
      yDate.setUTCDate(yDate.getUTCDate() - 1);
      const yesterdayKey = yDate.toISOString().slice(0, 10);
      const d2 = new Date(nowUtc);
      d2.setUTCDate(d2.getUTCDate() - 2);
      const twoDaysAgoKey = d2.toISOString().slice(0, 10);

      const tStats = byDay.get(todayKey);
      const yStats = byDay.get(yesterdayKey);
      const d2Stats = byDay.get(twoDaysAgoKey);
      const todayPct = tStats ? pctAccuracy(tStats.correct, tStats.total) : null;
      const yPct = yStats ? pctAccuracy(yStats.correct, yStats.total) : null;
      const d2Pct = d2Stats ? pctAccuracy(d2Stats.correct, d2Stats.total) : null;

      const evo = [];
      if (tStats && tStats.total > 0) {
        evo.push(
          `Hoje (UTC): ${todayPct}% de acerto em ${tStats.total} questão(ões) registrada(s).`
        );
      } else {
        evo.push("Hoje (UTC): ainda não há questões registradas no quiz.");
      }
      if (yStats && yStats.total > 0) {
        evo.push(`Ontem (UTC): ${yPct}% de acerto em ${yStats.total} questão(ões).`);
      }
      if (d2Stats && d2Stats.total > 0) {
        evo.push(`Dois dias atrás: ${d2Pct}% em ${d2Stats.total} questão(ões).`);
      }
      if (todayPct != null && yPct != null && yStats.total > 0 && tStats?.total > 0) {
        const delta = todayPct - yPct;
        if (delta > 0) evo.push(`Comparado a ontem: +${delta} ponto(s) percentual(is).`);
        else if (delta < 0) evo.push(`Comparado a ontem: ${delta} ponto(s) percentual(is) — normal oscilar; revise os erros.`);
        else evo.push("Comparado a ontem: mesma taxa de acerto.");
      }
      let sumP = 0;
      let nDays = 0;
      for (let i = 0; i < 7; i++) {
        const x = new Date(nowUtc);
        x.setUTCDate(x.getUTCDate() - i);
        const k = x.toISOString().slice(0, 10);
        const st = byDay.get(k);
        if (st && st.total > 0) {
          sumP += pctAccuracy(st.correct, st.total);
          nDays += 1;
        }
      }
      if (nDays > 0) {
        evo.push(
          `Média da taxa de acerto nos últimos ${nDays} dia(s) com registro (até 7): ${Math.round(sumP / nDays)}%.`
        );
      }
      setEvolutionLines(evo);

      const { data: visits, error: rvErr } = await activityApi.fetchRecentVisits(supabase, userId, 8);
      const topicIds = [...new Set((visits ?? []).map((v) => v.topic_id).filter(Boolean))];
      const { data: topicRows } = await activityApi.fetchTopicNames(supabase, topicIds);
      const nameById = Object.fromEntries((topicRows ?? []).map((t) => [t.id, t.name]));
      const subjIds = [...new Set((visits ?? []).map((v) => v.subject_id).filter(Boolean))];
      const { data: subjRows } = await activityApi.fetchSubjectNamesByIds(supabase, subjIds);
      const subjNameById = Object.fromEntries((subjRows ?? []).map((s) => [s.id, s.name]));

      if (!rvErr && visits?.length) {
        setRecentRows(
          visits.map((v) => ({
            topicId: v.topic_id,
            topicName: nameById[v.topic_id] || "Tópico",
            subjectName: v.subject_id ? subjNameById[v.subject_id] || "" : "",
            visitedAt: v.visited_at,
          }))
        );
      } else {
        setRecentRows([]);
      }

      const { data: allTopics, error: atErr } = mainExamId
        ? await activityApi.fetchAllTopicsForContest(supabase, mainExamId)
        : { data: [], error: null };

      const allTopicList = !atErr && allTopics?.length ? allTopics : [];
      const allTopicIds = allTopicList.map((t) => t.id);

      const { data: attemptRows, error: attErr } = await activityApi.fetchAttemptsForTopics(
        supabase,
        userId,
        allTopicIds
      );
      const attemptsInContest = attErr ? [] : (attemptRows ?? []);
      const contestAgg = aggregateAttempts(attemptsInContest);
      setQuizAttempts(contestAgg.total);
      setQuizCorrect(contestAgg.correct);
      setQuizWrong(contestAgg.wrong);

      const topicPctOverall = totalTopics > 0 ? (studiedSet.size / totalTopics) * 100 : 0;
      const quizTargetOverall =
        totalTopics > 0 ? Math.max(18, Math.round(totalTopics * 2.4)) : 28;
      const quizPctOverall =
        quizTargetOverall > 0 ? Math.min(100, (contestAgg.total / quizTargetOverall) * 100) : 0;
      const overallBlend =
        totalTopics > 0
          ? Math.round(topicPctOverall * 0.52 + quizPctOverall * 0.48)
          : Math.round(Math.min(100, (contestAgg.total / 28) * 100));
      setOverallProgressPct(Math.min(100, Math.max(0, overallBlend)));

      const wrongN = contestAgg.wrong;
      const remainingTopics =
        totalTopics > 0 ? Math.max(totalTopics - studiedSet.size, 0) : 0;
      const pctCatalog =
        totalTopics > 0 ? Math.round((studiedSet.size / totalTopics) * 100) : null;

      const missions = [];
      let pushedErrorPriority = false;

      if (
        wrongN > 0 &&
        daysLeft !== null &&
        daysLeft >= 0 &&
        daysLeft <= 14 &&
        (daysLeft <= 7 || wrongN >= 5 || (todayPct != null && todayPct < 55 && (tStats?.total ?? 0) >= 3))
      ) {
        pushedErrorPriority = true;
        missions.push({
          id: "errors_priority",
          label:
            daysLeft <= 7
              ? `Prioridade: ${wrongN} erro(s) no concurso com prova em ${daysLeft}d — revisão + quiz no tópico que falhou.`
              : `Você acumulou ${wrongN} erro(s) no concurso; combine 1 revisão leve com questões hoje.`,
          done: visitToday && attemptsToday,
          action: "study",
        });
      }

      missions.push(
        {
          id: "visit_today",
          label:
            todayPct != null && (tStats?.total ?? 0) >= 2 && todayPct < 50
              ? "Abrir um tópico hoje (UTC) — antes de forçar volume, consolide o que já errou."
              : "Abrir pelo menos um tópico hoje (contagem em UTC).",
          done: visitToday,
          action: "study",
        },
        {
          id: "quiz_today",
          label: "Registrar pelo menos uma questão no quiz hoje (revele a resposta para contar).",
          done: attemptsToday,
          action: "studyQuiz",
        }
      );

      if (mainExamId && totalTopics > 0 && remainingTopics > 0 && pctCatalog != null && pctCatalog < 100) {
        const tail =
          daysLeft !== null && daysLeft > 0 && daysLeft <= 45
            ? ` Prova em ~${daysLeft}d — ritmo constante ajuda mais que picos.`
            : "";
        missions.push({
          id: "catalog_progress",
          label: `Progresso no catálogo: ${pctCatalog}% visto, faltam ${remainingTopics} tópico(s) novo(s).${tail}`,
          done: visitToday,
          action: "study",
        });
      }

      if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 21) {
        missions.push({
          id: "exam_focus",
          label:
            daysLeft <= 7
              ? "Reta final: no mesmo dia, conteúdo + quiz (mesmo que seja revisão curta)."
              : "Prova chegando: misture tópico novo e treino objetivo no mesmo dia.",
          done: visitToday && attemptsToday,
          action: "study",
        });
      } else {
        missions.push({
          id: "combo",
          label: "Hábito forte: estudo de tópico + quiz no mesmo dia.",
          done: visitToday && attemptsToday,
          action: "study",
        });
      }

      if (wrongN > 0 && !pushedErrorPriority) {
        missions.push({
          id: "fix_errors",
          label: `${wrongN} erro(s) salvos no concurso — volte na explicação e refaça questões nos tópicos mais difíceis.`,
          done: attemptsToday && visitToday,
          action: "study",
        });
      }

      setDailyMissions(missions);

      const wrongByTopic = wrongCountByTopic(attemptsInContest);
      const attByTopic = attemptsCountByTopic(attemptsInContest);

      if (mainExamId && allTopicList.length) {
        const subjIdsForAll = [...new Set(allTopicList.map((t) => t.subject_id).filter(Boolean))];
        const { data: allSubj } = await activityApi.fetchSubjectNamesByIds(supabase, subjIdsForAll);
        const subjMap = Object.fromEntries((allSubj ?? []).map((s) => [s.id, s.name]));

        const bySub = new Map();
        for (const t of allTopicList) {
          const sid = t.subject_id;
          if (!sid) continue;
          if (!bySub.has(sid)) bySub.set(sid, { total: 0, visited: 0 });
          const row = bySub.get(sid);
          row.total += 1;
          if (studiedSet.has(t.id)) row.visited += 1;
        }
        const spList = [...bySub.entries()]
          .map(([subjectId, { total, visited }]) => ({
            subjectId,
            name: subjMap[subjectId] || "Matéria",
            total,
            visited,
            pct: total ? Math.round((visited / total) * 100) : 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSubjectProgress(spList);

        const wrongSub = new Map();
        const attSub = new Map();
        for (const t of allTopicList) {
          const sid = t.subject_id;
          if (!sid) continue;
          wrongSub.set(sid, (wrongSub.get(sid) ?? 0) + (wrongByTopic.get(t.id) ?? 0));
          attSub.set(sid, (attSub.get(sid) ?? 0) + (attByTopic.get(t.id) ?? 0));
        }
        let worstRate = -1;
        let worstSid = null;
        for (const [sid, att] of attSub.entries()) {
          if (att < 5) continue;
          const w = wrongSub.get(sid) ?? 0;
          const rate = w / att;
          if (w >= 4 && rate >= 0.4 && rate > worstRate) {
            worstRate = rate;
            worstSid = sid;
          }
        }
        let adaptiveLine = "";
        if (worstSid) {
          const nm = subjMap[worstSid] || "uma matéria";
          const w = wrongSub.get(worstSid) ?? 0;
          const a = attSub.get(worstSid) ?? 0;
          adaptiveLine = `Foco adaptativo: em “${nm}” o quiz está mais exigente (${w} erros em ${a} tentativas). Vale um bloco extra nessa matéria.`;
        }
        setAdaptiveFocusHint(adaptiveLine);

        const unstudied = allTopicList.filter((t) => !studiedSet.has(t.id));
        unstudied.sort((a, b) => {
          const s = String(a.subject_id || "").localeCompare(String(b.subject_id || ""));
          if (s !== 0) return s;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

        let timePrefix = "";
        if (daysLeft !== null && daysLeft >= 0) {
          if (daysLeft <= 7) {
            timePrefix = `Faltam ${daysLeft} dia(s) para a prova — `;
          } else if (daysLeft <= 30) {
            timePrefix = `Com ${daysLeft} dias até a prova, `;
          }
        }

        if (unstudied.length) {
          const next = unstudied[0];
          const sn = subjMap[next.subject_id] || "";
          const errHint =
            contestAgg.wrong > 0
              ? ` Você tem ${contestAgg.wrong} resposta(s) incorreta(s) registrada(s) no concurso; depois desse tópico novo, vale revisar os erros.`
              : "";
          setSuggestion(
            `${timePrefix}priorize um tópico ainda não visitado: “${next.name}”${
              sn ? ` (${sn})` : ""
            }.${errHint}`
          );
          setSuggestedNextTopicName(next.name || "");
          setSuggestedNextSubjectName(sn);
          setSuggestedStudyRoute({
            contestId: mainExamId,
            subjectId: next.subject_id,
            topicId: next.id,
          });
        } else {
          let bestTopic = null;
          let bestWrong = -1;
          let bestAttempts = -1;
          for (const t of allTopicList) {
            const w = wrongByTopic.get(t.id) ?? 0;
            const a = attByTopic.get(t.id) ?? 0;
            if (w > bestWrong || (w === bestWrong && a > bestAttempts)) {
              bestWrong = w;
              bestAttempts = a;
              bestTopic = t;
            }
          }
          if (bestTopic && bestWrong > 0) {
            const sn = subjMap[bestTopic.subject_id] || "";
            const rate = bestAttempts ? Math.round((bestWrong / bestAttempts) * 100) : 0;
            setSuggestion(
              `${timePrefix}você já abriu todos os tópicos; foque em revisar erros em “${bestTopic.name}”${
                sn ? ` (${sn})` : ""
              } — ${bestWrong} erro(s) registrado(s)${bestAttempts ? ` (~${rate}% das tentativas neste tópico)` : ""}.`
            );
            setSuggestedNextTopicName(bestTopic.name || "");
            setSuggestedNextSubjectName(sn);
            setSuggestedStudyRoute({
              contestId: mainExamId,
              subjectId: bestTopic.subject_id,
              topicId: bestTopic.id,
            });
          } else {
            setSuggestion(
              `${timePrefix}catálogo visitado sem erros registrados — ótimo momento para simulado ou revisão espaçada.`
            );
            setSuggestedStudyRoute(null);
            setSuggestedNextTopicName("");
            setSuggestedNextSubjectName("");
          }
        }
      } else if (mainExamId) {
        setSuggestion(
          "Adicione matérias e tópicos ao seu concurso principal para receber sugestões automáticas."
        );
        setSuggestedStudyRoute(null);
        setSuggestedNextTopicName("");
        setSuggestedNextSubjectName("");
        setSubjectProgress([]);
        setAdaptiveFocusHint("");
      } else {
        setSuggestion("Defina seu concurso principal no perfil para ver sugestões de estudo.");
        setSuggestedStudyRoute(null);
        setSuggestedNextTopicName("");
        setSuggestedNextSubjectName("");
        setSubjectProgress([]);
        setAdaptiveFocusHint("");
      }

      const remaining = Math.max(totalTopics - studiedSet.size, 0);
      let topicsPerDay = 0;
      if (daysLeft !== null && daysLeft > 0) {
        topicsPerDay = Math.ceil(remaining / daysLeft);
      } else if (daysLeft === 0) {
        topicsPerDay = remaining;
      }

      const hRaw = String(hoursPerDay || "2").replace("+", "");
      const h = Number.parseInt(hRaw, 10);
      const safeHours = Number.isFinite(h) && h > 0 ? Math.min(h, 12) : 2;

      const studyDaysCount =
        !streakErr && streakRows?.length
          ? new Set(streakRows.map((s) => utcDateKeyFromIso(s.visited_at)).filter(Boolean)).size
          : 0;
      const avgAttemptsDay =
        studyDaysCount > 0 && contestAgg.total > 0 ? contestAgg.total / studyDaysCount : 0;

      const baseQ = Math.max(3, Math.round(safeHours * 3));
      const targetQ =
        avgAttemptsDay > 0 ? Math.max(baseQ, Math.ceil(avgAttemptsDay * 1.15)) : baseQ;

      const lines = [];
      const pctStudied =
        totalTopics > 0 ? Math.round((studiedSet.size / totalTopics) * 100) : null;

      if (mainExamId && totalTopics > 0) {
        if (daysLeft !== null && daysLeft > 0) {
          if (topicsPerDay > 0) {
            const paceHint =
              daysLeft <= 7
                ? " Reta final: se cansar, troque um tópico novo por revisão — consistência vale mais que esgotar o catálogo."
                : daysLeft <= 21
                  ? " Combine um tópico novo com quiz no mesmo dia para fixar."
                  : "";
            lines.push(
              `Faltam ${daysLeft} dia(s) para a prova e você ainda não abriu ${remaining} tópico(s) do concurso principal (${pctStudied}% do catálogo já visto). Para cobrir o restante, mire em ~${topicsPerDay} tópico(s) novo(s) por dia — é uma média; ajuste ao seu ritmo real.${paceHint}`
            );
          } else {
            lines.push(
              `Faltam ${daysLeft} dia(s): você já passou por todos os tópicos do catálogo principal — ótimo momento para simulado, mapas mentais e corrigir falhas do quiz (${contestAgg.wrong} erro(s) registrados no concurso).`
            );
          }
        } else if (daysLeft === 0) {
          lines.push(
            "Prova hoje: vá com calma — revisão leve, uma olhada nos erros que mais aparecem no seu histórico e descanso. Você já preparou o terreno."
          );
        } else if (daysLeft !== null && daysLeft < 0) {
          lines.push(
            remaining > 0
              ? `A data da prova no perfil já passou; ainda há ${remaining} tópico(s) novos no catálogo. Atualize a data no perfil quando tiver a próxima prova — o app recalcula o ritmo para você.`
              : "Atualize a data da prova no perfil quando souber a próxima meta — assim o plano volta a sugerir ritmo diário."
          );
        } else {
          lines.push(
            remaining > 0
              ? `Faltam ${remaining} tópico(s) novos no concurso principal (${pctStudied}% do catálogo visto). Cadastre a data da prova no perfil para estimar quantos tópicos abrir por dia com menos pressão.`
              : "Catálogo do concurso principal sem tópicos novos pendentes — foque em revisão espaçada e no que ainda erra no quiz."
          );
        }
      }

      lines.push(
        avgAttemptsDay > 0
          ? `Quiz: mire em ~${targetQ} questões hoje (${safeHours} h/dia no perfil × sua média real de ${avgAttemptsDay.toFixed(1)} tentativa(s) registrada(s) por dia com estudo).`
          : `Quiz: tente pelo menos ${targetQ} questões hoje (baseado nas ${safeHours} h/dia do perfil). Os números sobem quando você revela a resposta no quiz — cada tentativa conta.`
      );

      if (contestAgg.wrong > 0) {
        const revisit = Math.min(contestAgg.wrong, 20);
        lines.push(
          `Erros: reserve um bloco para reabrir até ${revisit} questão(ões) que já errou neste concurso (${contestAgg.wrong} erro(s) no total — são pistas do que ainda não está automático).`
        );
      }

      if (todayPct != null && tStats && tStats.total >= 3 && todayPct < 58) {
        lines.push(
          `Hoje sua taxa no quiz está em ${todayPct}% (${tStats.total} questão(ões)) — antes de acelerar conteúdo novo, vale uma passada devagar nos erros de hoje.`
        );
      } else if (todayPct != null && tStats && tStats.total >= 3 && todayPct >= 82) {
        lines.push(
          `Hoje você está com ${todayPct}% de acerto no quiz — bom sinal; mantenha o ritmo e, se sobrar energia, ataque um tópico que ainda assusta.`
        );
      }

      lines.push(
        "Histórico: escolha um tópico da lista abaixo e releia ou refaça questões — revisão espaçada fixa melhor que só conteúdo novo."
      );
      setPlanLines(lines);

      const ls = readLastStudySession(userId);
      if (ls?.topicId && (ls.topicName || nameById[ls.topicId])) {
        const tname = ls.topicName || nameById[ls.topicId] || "Tópico";
        const tabLabel = TAB_LABELS[ls.activeStudyTab] || TAB_LABELS.explanation;
        const bits = [
          `Última área: ${tname} · ${tabLabel}.`,
          ls.explanationReady ? "Conteúdo do tópico já estava carregado na última sessão." : null,
        ];
        if (ls.quizTotal > 0) {
          bits.push(`Quiz: ${ls.quizRevealed ?? 0}/${ls.quizTotal} questão(ões) com resposta revelada.`);
        }
        const { data: lastAtt, error: lastErr } = await activityApi.fetchAttemptsForTopic(
          supabase,
          userId,
          ls.topicId
        );
        if (!lastErr && lastAtt?.length) {
          const a = aggregateAttempts(lastAtt);
          bits.push(`Neste tópico: ${a.correct} acerto(s) e ${a.wrong} erro(s) registrados.`);
        }
        const fallbackLine = bits.filter(Boolean).join(" ");
        const resumeJourney = buildStudyResumeJourney(ls, fallbackLine);
        setContinueProgressLine(resumeJourney?.whyLine || fallbackLine);
      } else {
        setContinueProgressLine("");
      }
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, mainExamId, examDate, hoursPerDay]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lastLocal = userId ? readLastStudySession(userId) : null;

  return {
    loading,
    refresh,
    topicsTotal,
    topicsStudiedMain,
    questionSends,
    quizAttempts,
    quizCorrect,
    quizWrong,
    studyDays,
    studyStreak,
    dailyMissions,
    evolutionLines,
    recentRows,
    suggestion,
    planLines,
    continueProgressLine,
    lastLocal,
    suggestedStudyRoute,
    overallProgressPct,
    subjectProgress,
    adaptiveFocusHint,
    suggestedNextTopicName,
    suggestedNextSubjectName,
  };
}
