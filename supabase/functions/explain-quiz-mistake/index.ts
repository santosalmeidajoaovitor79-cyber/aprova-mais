// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertRequiredEnv,
  jsonResponse,
  resolveAuthenticatedUser,
} from "../_shared/edgeAuth.ts";
import {
  formatExamContextLine,
  formatLearnerContextForPrompt,
  formatStudyContextLine,
} from "../_shared/promptContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const LOG_CTX = "explain-quiz-mistake";

function stripJsonFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : t;
}

function parseMistakePayload(raw: string): {
  mistakeSummary: string;
  whyCorrect: string;
  likelyConfusion: string;
} | null {
  const stripped = stripJsonFence(raw);
  try {
    const o = JSON.parse(stripped);
    return {
      mistakeSummary: String(o.mistakeSummary ?? o.summary ?? "").trim(),
      whyCorrect: String(o.whyCorrect ?? "").trim(),
      likelyConfusion: String(o.likelyConfusion ?? "").trim(),
    };
  } catch {
    return null;
  }
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
    const questionStem = String(body?.questionStem ?? "").trim();
    const options = Array.isArray(body?.options)
      ? body.options.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];
    const selectedIndex = Number(body?.selectedIndex);
    const correctIndex = Number(body?.correctIndex);
    const selectedLabel = String(body?.selectedLabel ?? "").trim();
    const correctLabel = String(body?.correctLabel ?? "").trim();
    const topicNameHint = String(body?.topicName ?? "").trim();
    const simplify = Boolean(body?.simplify);

    const examLine = formatExamContextLine(body?.examContext);
    const studyLine = formatStudyContextLine(body?.studyContext);
    const learnerLine = formatLearnerContextForPrompt(
      body?.learnerContext,
      body?.examContext,
      body?.studyContext
    );

    if (!topicId || !questionStem) {
      return jsonResponse(
        corsHeaders,
        {
          error: "topicId e questionStem são obrigatórios.",
          code: "VALIDATION_ERROR",
        },
        400
      );
    }

    if (
      !Number.isFinite(selectedIndex) ||
      !Number.isFinite(correctIndex) ||
      selectedIndex === correctIndex
    ) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Índices de resposta inválidos ou resposta já correta.",
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

    const { data: topicRow } = await supabaseAdmin
      .from("topics")
      .select("name")
      .eq("id", topicId)
      .maybeSingle();

    const topicLabel =
      topicRow?.name?.trim() || topicNameHint || "Tópico";

    const theorySnippet = (explanation?.content ?? "").slice(0, 3500);

    const optionsBlock = options
      .map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`)
      .join("\n");

    const simplifyBlock = simplify
      ? "\n\nIMPORTANTE: use linguagem bem simples, frases curtas e vocabulário acessível (como se explicasse para alguém cansado). Mantenha o JSON com as mesmas chaves.\n"
      : "";

    const userPrompt = `
Tópico: ${topicLabel}

Enunciado:
${questionStem}

Alternativas:
${optionsBlock}

O aluno marcou: ${String.fromCharCode(65 + selectedIndex)} (${selectedLabel || "—"})
A alternativa correta é: ${String.fromCharCode(65 + correctIndex)} (${correctLabel || "—"})

Trecho da teoria do tópico (referência; pode estar incompleto):
---
${theorySnippet || "(sem teoria salva — use só o enunciado e o bom senso pedagógico.)"}
---
${examLine}${studyLine}${learnerLine}${simplifyBlock}

Responda APENAS com um único objeto JSON válido (sem markdown), com as chaves exatas:
{
  "mistakeSummary": "1–2 frases: o que o erro indica sobre o ponto que falta clareza",
  "whyCorrect": "2–4 frases: por que a alternativa correta está certa",
  "likelyConfusion": "1–2 frases: confusão típica que leva a marcar a alternativa errada"
}
Use português do Brasil, tom acolhedor e direto. Não invente fatos legais ou dados de edital específicos.
`.trim();

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: simplify
                ? "Você é a Yara, tutora de concursos no Brasil. Só responda com JSON válido, sem texto fora do objeto. Priorize clareza extrema."
                : "Você é a Yara, tutora de concursos no Brasil. Só responda com JSON válido, sem texto fora do objeto.",
            },
            { role: "user", content: userPrompt },
          ],
          temperature: simplify ? 0.25 : 0.35,
        }),
      }
    );

    if (!groqResponse.ok) {
      const groqErrorText = await groqResponse.text();
      return jsonResponse(
        corsHeaders,
        {
          error: "Erro ao consultar a Groq.",
          code: "GROQ_ERROR",
          details: groqErrorText,
        },
        groqResponse.status
      );
    }

    const groqData = await groqResponse.json();
    const raw =
      groqData?.choices?.[0]?.message?.content?.trim() ||
      "";

    const parsed = parseMistakePayload(raw);
    if (!parsed || (!parsed.mistakeSummary && !parsed.whyCorrect)) {
      return jsonResponse(
        corsHeaders,
        {
          error: "Resposta da IA em formato inesperado.",
          code: "PARSE_ERROR",
        },
        502
      );
    }

    return jsonResponse(
      corsHeaders,
      {
        mistakeSummary:
          parsed.mistakeSummary ||
          "Vamos revisar esse ponto com calma na teoria e no chat.",
        whyCorrect:
          parsed.whyCorrect ||
          "A alternativa correta fecha melhor com o que o enunciado pede.",
        likelyConfusion:
          parsed.likelyConfusion ||
          "É comum confundir o foco do comando ou a nuance entre alternativas parecidas.",
      },
      200
    );
  } catch (e) {
    console.error(`[${LOG_CTX}]`, e);
    return jsonResponse(
      corsHeaders,
      {
        error: "Erro interno ao explicar o erro.",
        code: "INTERNAL",
      },
      500
    );
  }
});
