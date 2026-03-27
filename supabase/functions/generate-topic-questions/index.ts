// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertRequiredEnv,
  jsonResponse,
  resolveAuthenticatedUser,
} from "../_shared/edgeAuth.ts";
import {
  formatExamContextBullet,
  formatLearnerContextForPrompt,
  formatStudyContextBullet,
} from "../_shared/promptContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const LOG_CTX = "generate-topic-questions";

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}

function normalizeQuestions(
  raw: unknown,
  maxItems: number
): Array<{
  question: string;
  options: string[];
  correctIndex: number;
  rationale: string;
}> {
  if (!raw || typeof raw !== "object") return [];
  const q = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(q)) return [];

  const cap = Math.min(8, Math.max(1, maxItems + 2));
  const out: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    rationale: string;
  }> = [];

  for (const item of q.slice(0, cap)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const question = typeof o.question === "string" ? o.question.trim() : "";
    let options: string[] = [];
    if (Array.isArray(o.options)) {
      options = o.options.map((x) => String(x).trim()).filter(Boolean);
    }
    const ci = typeof o.correctIndex === "number" ? o.correctIndex : Number(o.correctIndex);
    const rationale = typeof o.rationale === "string" ? o.rationale.trim() : "";

    if (!question || options.length < 2) continue;
    const correctIndex = Number.isFinite(ci) ? Math.max(0, Math.min(options.length - 1, Math.floor(ci))) : 0;
    out.push({ question, options, correctIndex, rationale });
    if (out.length >= maxItems) break;
  }

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const envErr = assertRequiredEnv(corsHeaders, LOG_CTX);
    if (envErr) return envErr;

    const authResult = await resolveAuthenticatedUser(req, corsHeaders, LOG_CTX);
    if ("response" in authResult) return authResult.response;

    const { supabaseUrl } = authResult;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqApiKey = Deno.env.get("GROQ_API_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const topicId = body?.topicId?.trim();
    const recoveryMode = Boolean(body?.recoveryMode);
    const recoveryCtx =
      body?.recoveryContext && typeof body?.recoveryContext === "object"
        ? (body.recoveryContext as Record<string, unknown>)
        : null;
    const recoveryQuestionCountRaw = Number(body?.recoveryQuestionCount);
    const recoveryQuestionCount = recoveryMode
      ? Math.min(3, Math.max(2, Number.isFinite(recoveryQuestionCountRaw) ? Math.floor(recoveryQuestionCountRaw) : 2))
      : 3;
    const customCountRaw = Number(body?.questionCount);
    const customQuestionCount = Math.min(
      6,
      Math.max(1, Number.isFinite(customCountRaw) ? Math.floor(customCountRaw) : 3)
    );
    const examLine = formatExamContextBullet(body?.examContext);
    const studyLine = formatStudyContextBullet(body?.studyContext);
    const learnerLine = formatLearnerContextForPrompt(
      body?.learnerContext,
      body?.examContext,
      body?.studyContext
    );

    if (!topicId) {
      return jsonResponse(
        corsHeaders,
        { error: "O campo topicId é obrigatório.", code: "VALIDATION_ERROR" },
        400
      );
    }

    if (recoveryMode && !recoveryCtx) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Modo recuperação exige recoveryContext.",
          code: "VALIDATION_ERROR",
        },
        400
      );
    }

    const { data: explanation } = await supabaseAdmin
      .from("topic_explanations")
      .select("content")
      .eq("topic_id", topicId)
      .maybeSingle();

    const { data: topicRow, error: topicErr } = await supabaseAdmin
      .from("topics")
      .select(
        `
        name,
        description,
        subjects (
          name,
          contests ( name )
        )
      `
      )
      .eq("id", topicId)
      .maybeSingle();

    if (topicErr || !topicRow) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Tópico não encontrado.",
          code: "TOPIC_NOT_FOUND",
          details: topicErr ? { message: topicErr.message } : {},
        },
        404
      );
    }

    const topicLabel = topicRow.name ?? "Tópico";
    const subjectLabel = topicRow.subjects?.name ?? "Matéria";
    const contestLabel = topicRow.subjects?.contests?.name ?? "Concurso";
    const desc = topicRow.description?.trim() ?? "";
    const expl = explanation?.content?.trim() ?? "";

    const recoveryBlock =
      recoveryMode && recoveryCtx
        ? `

MINI TREINO DE RECUPERAÇÃO (prioridade máxima)
O aluno acabou de errar uma questão neste tópico. Gere questões que ataquem diretamente a confusão descrita — não repita o mesmo enunciado, mas explore o mesmo ponto conceitual com ângulos diferentes.

Questão em que errou (referência):
- Enunciado: ${String(recoveryCtx.questionStem ?? "").slice(0, 900)}
- Marcou: ${String(recoveryCtx.selectedLabel ?? "—")}
- Correta: ${String(recoveryCtx.correctLabel ?? "—")}

Análise da Yara sobre o erro:
- Resumo do erro: ${String(recoveryCtx.mistakeSummary ?? "").slice(0, 600)}
- Por que a correta vale: ${String(recoveryCtx.whyCorrect ?? "").slice(0, 600)}
- Confusão provável (foco do mini treino): ${String(recoveryCtx.likelyConfusion ?? "").slice(0, 600)}
`
        : "";

    const questionTarget = recoveryMode ? recoveryQuestionCount : customQuestionCount;
    const system = recoveryMode
      ? `Você cria questões objetivas para concursos públicos no Brasil, focadas em corrigir uma confusão específica do aluno.
Responda APENAS com um objeto JSON válido, sem markdown, sem texto fora do JSON.
Formato obrigatório:
{"questions":[{"question":"enunciado","options":["A","B","C","D"],"correctIndex":0,"rationale":"por que a alternativa correta"}]}
- Exatamente ${questionTarget} questões (nem mais, nem menos).
- Cada questão: exatamente 4 alternativas (strings).
- correctIndex: índice 0-based da alternativa correta (0 a 3).
- As questões devem desafiar especificamente a "confusão provável" informada; use distratores plausíveis que reflitam esse equívoco.
- Não invente leis ou dados específicos sem base no contexto.
- Linguagem: português do Brasil.`
      : `Você cria questões objetivas para concursos públicos no Brasil, no papel de tutor que quer que o aluno aprenda (não só decore).
Responda APENAS com um objeto JSON válido, sem markdown, sem texto fora do JSON.
Formato obrigatório:
{"questions":[{"question":"enunciado","options":["A","B","C","D"],"correctIndex":0,"rationale":"por que a alternativa correta"}]}
- Exatamente ${questionTarget} questões (nem mais, nem menos).
- Cada questão: exatamente 4 alternativas (strings).
- correctIndex: índice 0-based da alternativa correta (0 a 3).
- Não invente leis ou dados específicos sem base no contexto; se faltar base, use questões sobre conceitos gerais do tema.
- Linguagem: português do Brasil.`;

    const userPrompt = `Contexto:
- Concurso: ${contestLabel}
- Matéria: ${subjectLabel}
- Tópico: ${topicLabel}
${desc ? `- Descrição do tópico: ${desc}` : ""}
${expl ? `- Resumo da explicação já estudada (use como base):\n${expl.slice(0, 6000)}` : "- Ainda não há explicação longa; use o nome do tópico e a descrição."}${examLine}${studyLine}${learnerLine}
${recoveryBlock}
${
  recoveryMode
    ? `Gere exatamente ${questionTarget} questões de múltipla escolha para o mini treino de recuperação, alinhadas ao tópico e ao bloco de confusão acima.`
    : `Gere ${questionTarget} questões de múltipla escolha alinhadas a esse conteúdo. Priorize formatos de cobrança que costumam aparecer em provas objetivas do tipo do concurso; se o prazo até a prova for curto, favoreça pegadinhas clássicas e revisão objetiva. Se a taxa de acerto do aluno nas questões registradas for baixa, evite enunciados excessivamente complexos e reforce conceitos centrais.`
}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        temperature: recoveryMode ? 0.32 : 0.35,
      }),
    });

    if (!groqResponse.ok) {
      const groqErrorText = await groqResponse.text();
      return jsonResponse(
        corsHeaders,
        { error: "Erro ao consultar a Groq.", code: "GROQ_ERROR", details: groqErrorText },
        groqResponse.status
      );
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData?.choices?.[0]?.message?.content?.trim() || "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(rawContent));
    } catch (e) {
      console.error(`[${LOG_CTX}] JSON parse falhou`, e, rawContent.slice(0, 400));
      return jsonResponse(
        corsHeaders,
        {
          error: "A IA não retornou JSON válido. Tente novamente.",
          code: "QUESTIONS_PARSE_ERROR",
          details: { snippet: rawContent.slice(0, 280) },
        },
        502
      );
    }

    const questions = normalizeQuestions(parsed, questionTarget);

    const minRequired = recoveryMode
      ? 2
      : Math.max(1, Math.ceil(questionTarget * 0.75));
    if (questions.length < minRequired) {
      return jsonResponse(
        corsHeaders,
        {
          error: recoveryMode
            ? `Não foi possível obter pelo menos ${minRequired} questões de recuperação.`
            : `Não foi possível obter ${minRequired} questão(ões) completa(s).`,
          code: "QUESTIONS_INCOMPLETE",
          details: { received: questions.length, recoveryMode, expected: questionTarget },
        },
        502
      );
    }

    const finalQs = questions.slice(0, questionTarget);
    const stamp = Date.now();
    const stamped = finalQs.map((q, i) => ({
      id: `q-${topicId}-${i}-${stamp}`,
      ...q,
    }));

    return jsonResponse(corsHeaders, { questions: stamped }, 200);
  } catch (error) {
    console.error(`[${LOG_CTX}] Erro não tratado`, error);
    return jsonResponse(
      corsHeaders,
      { error: error?.message || "Erro interno desconhecido.", code: "INTERNAL_ERROR" },
      500
    );
  }
});
